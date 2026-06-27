import { readFileSync } from "node:fs";
import path from "node:path";
import { Worker } from "bullmq";
import {
  AssetKind,
  PointTransactionStatus,
  PointTransactionType,
  Prisma,
  PrismaClient,
  ProviderKey,
  TaskStatus
} from "@ai-image/db";
import { GENERATION_QUEUE_NAME, type GenerationTaskPayload } from "@ai-image/shared";
import { createAssetStorageFromEnv } from "@ai-image/storage";

loadRootEnv();

const prisma = new PrismaClient();
const assetStorage = createAssetStorageFromEnv();
const redisUrl = process.env.REDIS_QUEUE_URL ?? process.env.REDIS_URL ?? "redis://localhost:6379";
const queueName = process.env.GENERATION_QUEUE_NAME ?? GENERATION_QUEUE_NAME;
const parsedRedisUrl = new URL(redisUrl);
const workerConcurrency = normalizePositiveInteger(process.env.WORKER_CONCURRENCY, 2);

const connection = {
  host: parsedRedisUrl.hostname,
  port: Number(parsedRedisUrl.port || 6379),
  username: parsedRedisUrl.username || undefined,
  password: parsedRedisUrl.password || undefined,
  tls: parsedRedisUrl.protocol === "rediss:" ? {} : undefined,
  maxRetriesPerRequest: null
};

const worker = new Worker<GenerationTaskPayload>(
  queueName,
  async (job) => {
    const startedAt = new Date();

    try {
      await prisma.generationTask.update({
        where: { id: job.data.taskId },
        data: {
          status: TaskStatus.PROCESSING,
          startedAt,
          errorMessage: null
        }
      });

      const providerResult = await generateImages(job.data, async (image) => {
        await persistGeneratedImage(job.data, image);
      });
      const durationMs = providerResult.durationMs;
      const completedAt = new Date();
      const bucket = providerResult.bucket;

      await prisma.$transaction(async (tx) => {
        await tx.generationTask.update({
          where: { id: job.data.taskId },
          data: {
            status: TaskStatus.SUCCEEDED,
            providerTaskId: providerResult.providerTaskId ?? job.id,
            completedAt,
            errorMessage: null
          }
        });

        await captureGenerationHold(tx, job.data.pointHoldTransactionId);

        await tx.providerCallLog.create({
          data: {
            taskId: job.data.taskId,
            provider: toDbProvider(job.data.provider),
            requestMeta: {
              prompt: job.data.prompt,
              negativePrompt: job.data.negativePrompt,
              params: job.data.params as Prisma.InputJsonObject,
              referenceAssetIds: job.data.referenceAssetIds
            } satisfies Prisma.InputJsonValue,
            responseMeta: {
              bucket,
              objectKeys: providerResult.images.map((image) => image.objectKey),
              mock: job.data.provider === "mock",
              providerTaskId: providerResult.providerTaskId,
              provider: providerResult.responseMeta
            } satisfies Prisma.InputJsonValue,
            statusCode: providerResult.statusCode,
            durationMs
          }
        });
      });

      return {
        taskId: job.data.taskId,
        provider: job.data.provider,
        imageObjectKeys: providerResult.images.map((image) => image.objectKey),
        completedAt: completedAt.toISOString()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mock provider failed";
      const durationMs = Date.now() - startedAt.getTime();
      const requestedImageCount = normalizeImageCount(job.data.params.imageCount);
      const generatedAssetCount = await prisma.asset.count({
        where: {
          taskId: job.data.taskId,
          kind: AssetKind.RESULT
        }
      });
      const failedTask = await prisma.generationTask.findUniqueOrThrow({
        where: { id: job.data.taskId },
        select: { pointCost: true }
      });
      const capturedAmount = Math.min(
        failedTask.pointCost,
        Math.floor((failedTask.pointCost * Math.min(generatedAssetCount, requestedImageCount)) / requestedImageCount)
      );
      const hasPartialResults = generatedAssetCount > 0 && capturedAmount > 0;
      const persistedErrorMessage = hasPartialResults
        ? `${message} (${generatedAssetCount}/${requestedImageCount} images generated; unused points refunded)`
        : message;

      await prisma.$transaction(async (tx) => {
        if (hasPartialResults) {
          await settleGenerationHold(tx, job.data.pointHoldTransactionId, capturedAmount);
        } else {
          await refundGenerationHold(tx, job.data.pointHoldTransactionId);
        }

        await tx.generationTask.update({
          where: { id: job.data.taskId },
          data: {
            status: hasPartialResults ? TaskStatus.FAILED : TaskStatus.REFUNDED,
            errorMessage: persistedErrorMessage,
            completedAt: new Date()
          }
        });

        await tx.providerCallLog.create({
          data: {
            taskId: job.data.taskId,
            provider: toDbProvider(job.data.provider),
            requestMeta: {
              prompt: job.data.prompt,
              negativePrompt: job.data.negativePrompt,
              params: job.data.params as Prisma.InputJsonObject,
              referenceAssetIds: job.data.referenceAssetIds
            } satisfies Prisma.InputJsonValue,
            responseMeta: {
              error: message,
              generatedAssetCount,
              requestedImageCount,
              mock: job.data.provider === "mock"
            } satisfies Prisma.InputJsonValue,
            durationMs,
            errorMessage: message
          }
        });
      });

      throw error;
    }
  },
  { connection, concurrency: workerConcurrency }
);

worker.on("completed", (job) => {
  console.log(`Generation job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Generation job ${job?.id ?? "unknown"} failed`, error);
});

async function captureGenerationHold(tx: Prisma.TransactionClient, holdTransactionId: string) {
  const hold = await tx.pointTransaction.findUnique({
    where: { id: holdTransactionId }
  });

  if (!hold || hold.type !== PointTransactionType.GENERATION_HOLD) {
    throw new Error("Point hold not found");
  }

  await settleGenerationHold(tx, holdTransactionId, Math.abs(hold.amount));
}

async function settleGenerationHold(tx: Prisma.TransactionClient, holdTransactionId: string, capturedAmount: number) {
  const hold = await tx.pointTransaction.findUnique({
    where: { id: holdTransactionId }
  });

  if (!hold || hold.type !== PointTransactionType.GENERATION_HOLD) {
    throw new Error("Point hold not found");
  }

  if (hold.status === PointTransactionStatus.COMMITTED || hold.status === PointTransactionStatus.REVERSED) {
    return;
  }

  if (hold.status !== PointTransactionStatus.PENDING) {
    throw new Error("Point hold is already closed");
  }

  const amount = Math.abs(hold.amount);
  const normalizedCapturedAmount = Math.min(amount, Math.max(0, Math.floor(capturedAmount)));
  const refundedAmount = amount - normalizedCapturedAmount;
  const updateResult = await tx.userBalance.updateMany({
    where: {
      userId: hold.userId,
      held: { gte: amount }
    },
    data: {
      available: { increment: refundedAmount },
      held: { decrement: amount }
    }
  });

  if (updateResult.count !== 1) {
    throw new Error("Held points are not available");
  }

  const balance = await tx.userBalance.findUniqueOrThrow({
    where: { userId: hold.userId }
  });

  await tx.pointTransaction.update({
    where: { id: hold.id },
    data: {
      status: normalizedCapturedAmount > 0 ? PointTransactionStatus.COMMITTED : PointTransactionStatus.REVERSED,
      committedAt: new Date()
    }
  });

  if (normalizedCapturedAmount > 0) {
    await tx.pointTransaction.create({
      data: {
        userId: hold.userId,
        taskId: hold.taskId,
        relatedTransactionId: hold.id,
        type: PointTransactionType.GENERATION_CAPTURE,
        status: PointTransactionStatus.COMMITTED,
        amount: -normalizedCapturedAmount,
        balanceAfter: balance.available,
        heldAfter: balance.held,
        reason: "Generation points captured",
        committedAt: new Date()
      }
    });
  }

  if (refundedAmount > 0) {
    await tx.pointTransaction.create({
      data: {
        userId: hold.userId,
        taskId: hold.taskId,
        relatedTransactionId: hold.id,
        type: PointTransactionType.GENERATION_REFUND,
        status: PointTransactionStatus.COMMITTED,
        amount: refundedAmount,
        balanceAfter: balance.available,
        heldAfter: balance.held,
        reason: "Unused generation points refunded",
        committedAt: new Date()
      }
    });
  }
}

async function refundGenerationHold(tx: Prisma.TransactionClient, holdTransactionId: string) {
  await settleGenerationHold(tx, holdTransactionId, 0);
}

function toDbProvider(provider: GenerationTaskPayload["provider"]) {
  switch (provider) {
    case "mock":
      return ProviderKey.MOCK;
    case "provider_a":
      return ProviderKey.PROVIDER_A;
    case "provider_b":
      return ProviderKey.PROVIDER_B;
  }
}

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

console.log(`Worker listening on queue "${queueName}" with concurrency ${workerConcurrency}`);

interface GeneratedImage {
  bucket: string;
  objectKey: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

interface ProviderResult {
  bucket: string;
  statusCode: number;
  durationMs: number;
  images: GeneratedImage[];
  providerTaskId?: string;
  responseMeta?: Prisma.InputJsonValue;
}

interface SingleProviderCallResult {
  durationMs: number;
  imageIndex: number;
  images: GeneratedImage[];
  providerTaskId?: string;
  responseBody: unknown;
  statusCode: number;
  prompt: string;
}

async function persistGeneratedImage(payload: GenerationTaskPayload, image: GeneratedImage) {
  const existing = await prisma.asset.findFirst({
    where: {
      taskId: payload.taskId,
      kind: AssetKind.RESULT,
      objectKey: image.objectKey
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.asset.create({
    data: {
      userId: payload.userId,
      taskId: payload.taskId,
      kind: AssetKind.RESULT,
      bucket: image.bucket,
      objectKey: image.objectKey,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      sizeBytes: image.sizeBytes
    }
  });
}

async function generateImages(payload: GenerationTaskPayload, onImageGenerated: (image: GeneratedImage) => Promise<void>) {
  const startedAtMs = Date.now();
  const resolution = normalizeResolution(payload.params.resolution);
  const size = normalizeImageSize(payload.params.aspectRatio ?? payload.params.size);
  const dimensions = normalizeDimensions(size, resolution);

  if (payload.provider === "mock") {
    const imageCount = normalizeImageCount(payload.params.imageCount);
    const delayMs = Number(process.env.MOCK_PROVIDER_DELAY_MS ?? 2500);
    const imageStaggerMs = normalizeNonNegativeInteger(process.env.MOCK_PROVIDER_IMAGE_STAGGER_MS, 150);
    await new Promise((resolve) => setTimeout(resolve, Number.isFinite(delayMs) ? delayMs : 2500));

    if (payload.prompt.toLowerCase().includes("[fail]")) {
      throw new Error("Mock provider failure requested by prompt");
    }

    return {
      bucket: assetStorage.bucketName,
      statusCode: 200,
      durationMs: Date.now() - startedAtMs,
      images: await mapWithConcurrency(imageCount, normalizePositiveInteger(process.env.PROVIDER_IMAGE_CONCURRENCY, 2), async (index) => {
        await sleep(imageStaggerMs * index);

        if (payload.prompt.toLowerCase().includes(`[fail:${index + 1}]`)) {
          throw new Error(`Mock provider failure requested for image ${index + 1}`);
        }

        const image = await saveImage(payload.taskId, index, Buffer.from(MOCK_PNG_BASE64, "base64"), dimensions, dimensions);
        await onImageGenerated(image);
        return image;
      })
    } satisfies ProviderResult;
  }

  const config = getProviderConfig(payload.provider);
  const imageCount = normalizeImageCount(payload.params.imageCount);
  const imageUrls = readReferenceImageUrls(payload.params);

  const calls = await mapWithConcurrency(
    imageCount,
    normalizePositiveInteger(process.env.PROVIDER_IMAGE_CONCURRENCY, 2),
    async (index) => {
      const call = await callProviderForSingleImage({
        config,
        dimensions,
        imageIndex: index,
        imageUrls,
        payload,
        resolution,
        size,
        totalImages: imageCount
      });

      for (const image of call.images) {
        await onImageGenerated(image);
      }

      return call;
    }
  );

  return {
    bucket: assetStorage.bucketName,
    statusCode: calls[calls.length - 1]?.statusCode ?? 200,
    durationMs: Date.now() - startedAtMs,
    images: calls.flatMap((call) => call.images),
    providerTaskId: calls.map((call) => call.providerTaskId).filter((taskId): taskId is string => Boolean(taskId)).join(",") || undefined,
    responseMeta: summarizeProviderCalls(calls)
  } satisfies ProviderResult;
}

async function callProviderForSingleImage({
  config,
  dimensions,
  imageIndex,
  imageUrls,
  payload,
  resolution,
  size,
  totalImages
}: {
  config: ReturnType<typeof getProviderConfig>;
  dimensions: number;
  imageIndex: number;
  imageUrls: string[];
  payload: GenerationTaskPayload;
  resolution: ReturnType<typeof normalizeResolution>;
  size: string;
  totalImages: number;
}) {
  const startedAtMs = Date.now();
  const prompt = buildSingleImagePrompt(payload, imageIndex, totalImages);
  const requestBody: Record<string, unknown> = {
    model: config.model,
    prompt,
    n: 1,
    size,
    resolution
  };

  if (imageUrls.length > 0) {
    requestBody.image_urls = imageUrls;
  }

  const response = await fetch(new URL(config.path, config.baseUrl), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  const responseBody = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readProviderError(responseBody) ?? `Provider request failed with ${response.status}`);
  }

  const submittedTaskId = readSubmittedTaskId(responseBody);
  const finalResponseBody = submittedTaskId ? await pollProviderTask(config, submittedTaskId) : responseBody;
  const images = await extractProviderImages(finalResponseBody, payload.taskId, dimensions, imageIndex);

  if (images.length === 0) {
    throw new Error(`Provider response for image ${imageIndex + 1} did not contain an image`);
  }

  const durationMs = Date.now() - startedAtMs;
  console.log(`Provider image completed task=${payload.taskId} image=${imageIndex + 1}/${totalImages} durationMs=${durationMs}`);

  return {
    durationMs,
    imageIndex,
    images: images.slice(0, 1),
    providerTaskId: submittedTaskId ?? undefined,
    responseBody: finalResponseBody,
    statusCode: response.status,
    prompt
  } satisfies SingleProviderCallResult;
}

function getProviderConfig(provider: Exclude<GenerationTaskPayload["provider"], "mock">) {
  const prefix = provider === "provider_a" ? "PROVIDER_A" : "PROVIDER_B";
  const apiKey = process.env[`${prefix}_API_KEY`] ?? process.env.THIRD_PARTY_IMAGE_API_KEY;
  const baseUrl = process.env[`${prefix}_BASE_URL`] ?? process.env.THIRD_PARTY_IMAGE_API_BASE_URL;
  const model = process.env[`${prefix}_MODEL`] ?? process.env.THIRD_PARTY_IMAGE_MODEL ?? "gpt-image-1";
  const apiPath = process.env[`${prefix}_IMAGE_PATH`] ?? process.env.THIRD_PARTY_IMAGE_API_PATH ?? "/v1/images/generations";
  const taskPath = process.env[`${prefix}_TASK_PATH`] ?? process.env.THIRD_PARTY_IMAGE_TASK_PATH ?? "/v1/tasks";

  if (!apiKey || !baseUrl) {
    throw new Error(`${prefix}_API_KEY and ${prefix}_BASE_URL are required`);
  }

  return {
    apiKey,
    baseUrl: baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
    model,
    path: apiPath.startsWith("/") ? apiPath.slice(1) : apiPath,
    taskPath: taskPath.startsWith("/") ? taskPath.slice(1) : taskPath
  };
}

async function extractProviderImages(responseBody: unknown, taskId: string, dimensions: number, startIndex = 0) {
  if (!responseBody || typeof responseBody !== "object") {
    return [];
  }

  const resultImages = readNestedImages(responseBody);
  if (resultImages.length > 0) {
    return downloadProviderImageUrls(resultImages, taskId, dimensions, startIndex);
  }

  const data = (responseBody as { data?: unknown }).data;

  if (!Array.isArray(data)) {
    return [];
  }

  const images: GeneratedImage[] = [];

  for (const [index, item] of data.entries()) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const image = item as { b64_json?: unknown; url?: unknown };

    if (typeof image.b64_json === "string") {
      const base64 = image.b64_json.includes(",") ? image.b64_json.split(",").pop() ?? "" : image.b64_json;
      images.push(await saveImage(taskId, startIndex + index, Buffer.from(base64, "base64"), dimensions, dimensions));
      continue;
    }

    if (typeof image.url === "string") {
      images.push(await downloadProviderImage(image.url, taskId, startIndex + index, dimensions));
    }
  }

  return images;
}

async function pollProviderTask(config: ReturnType<typeof getProviderConfig>, taskId: string) {
  const pollIntervalMs = normalizePositiveInteger(process.env.PROVIDER_TASK_POLL_INTERVAL_MS, 5000);
  const initialDelayMs = normalizePositiveInteger(process.env.PROVIDER_TASK_INITIAL_DELAY_MS, 12000);
  const maxAttempts = normalizePositiveInteger(process.env.PROVIDER_TASK_MAX_ATTEMPTS, 120);

  await sleep(initialDelayMs);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const url = new URL(`${config.taskPath.replace(/\/$/, "")}/${encodeURIComponent(taskId)}`, config.baseUrl);
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${config.apiKey}`
      }
    });
    const responseBody = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(readProviderError(responseBody) ?? `Provider task polling failed with ${response.status}`);
    }

    const status = readTaskStatus(responseBody);

    if (status === "completed" || status === "succeeded" || status === "succeed" || status === "success" || status === "done") {
      return responseBody;
    }

    if (status === "failed" || status === "error" || status === "cancelled" || status === "canceled") {
      throw new Error(readProviderError(responseBody) ?? `Provider task ${taskId} failed`);
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs);
    }
  }

  throw new Error(`Provider task ${taskId} timed out`);
}

function readSubmittedTaskId(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const data = (responseBody as { data?: unknown }).data;
  const first = Array.isArray(data) ? data[0] : data;

  if (!first || typeof first !== "object") {
    return null;
  }

  const taskId = (first as { task_id?: unknown; taskId?: unknown; id?: unknown }).task_id ??
    (first as { task_id?: unknown; taskId?: unknown; id?: unknown }).taskId ??
    (first as { task_id?: unknown; taskId?: unknown; id?: unknown }).id;

  return typeof taskId === "string" && taskId.trim() ? taskId : null;
}

function readTaskStatus(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const data = (responseBody as { data?: unknown }).data;
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : responseBody;
  const status = (source as { status?: unknown }).status;

  return typeof status === "string" ? status.toLowerCase() : null;
}

function readNestedImages(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return [];
  }

  const data = (responseBody as { data?: unknown }).data;
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : responseBody;
  const result = (source as { result?: unknown }).result;

  if (!result || typeof result !== "object") {
    return [];
  }

  const images = (result as { images?: unknown }).images;

  if (!Array.isArray(images)) {
    return [];
  }

  const urls: string[] = [];

  for (const image of images) {
    if (!image || typeof image !== "object") {
      continue;
    }

    const urlValue = (image as { url?: unknown }).url;

    if (typeof urlValue === "string") {
      urls.push(urlValue);
    }

    if (Array.isArray(urlValue)) {
      urls.push(...urlValue.filter((url): url is string => typeof url === "string"));
    }
  }

  return urls;
}

async function downloadProviderImageUrls(urls: string[], taskId: string, dimensions: number, startIndex = 0) {
  return Promise.all(urls.map((url, index) => downloadProviderImage(url, taskId, startIndex + index, dimensions)));
}

async function downloadProviderImage(url: string, taskId: string, index: number, dimensions: number) {
  const imageResponse = await fetch(url);

  if (!imageResponse.ok) {
    throw new Error(`Provider image download failed with ${imageResponse.status}`);
  }

  return saveImage(taskId, index, Buffer.from(await imageResponse.arrayBuffer()), dimensions, dimensions);
}

async function saveImage(taskId: string, index: number, bytes: Buffer, width: number, height: number) {
  const suffix = index + 1;
  const objectKey = `local-results/${taskId}-${suffix}.png`;
  const dimensions = readPngDimensions(bytes) ?? { width, height };
  const stored = await assetStorage.putObject({
    objectKey,
    bytes,
    contentType: "image/png"
  });

  return {
    bucket: stored.bucket,
    objectKey: stored.objectKey,
    mimeType: "image/png",
    width: dimensions.width,
    height: dimensions.height,
    sizeBytes: bytes.byteLength
  };
}

function readPngDimensions(bytes: Buffer) {
  const pngSignature = "89504e470d0a1a0a";

  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

function normalizeImageSize(value: unknown) {
  if (typeof value !== "string") {
    return "1:1";
  }

  const normalized = value.trim().toLowerCase();
  const allowedSizes = new Set([
    "auto",
    "1:1",
    "3:2",
    "2:3",
    "4:3",
    "3:4",
    "5:4",
    "4:5",
    "16:9",
    "9:16",
    "2:1",
    "1:2",
    "3:1",
    "1:3",
    "21:9",
    "9:21"
  ]);

  if (allowedSizes.has(normalized) || /^\d{2,5}x\d{2,5}$/.test(normalized)) {
    return normalized;
  }

  return "1:1";
}

function readReferenceImageUrls(params: GenerationTaskPayload["params"]) {
  const value = params.image_urls ?? params.referenceImageUrls ?? params.referenceImageDataUri ?? params.referenceImageUrl;

  if (Array.isArray(value)) {
    return value.filter((url): url is string => isSupportedReferenceImageUrl(url));
  }

  if (isSupportedReferenceImageUrl(value)) {
    return [value];
  }

  return [];
}

function buildSingleImagePrompt(payload: GenerationTaskPayload, imageIndex: number, totalImages: number) {
  const imagePrompts = readImagePrompts(payload.params);
  const prompt = imagePrompts[imageIndex]?.trim();

  if (prompt) {
    return prompt;
  }

  return [
    payload.prompt,
    "",
    `本次只生成第 ${imageIndex + 1} 张独立图片，共 ${totalImages} 张独立图片。`,
    "强制要求：只输出一张完整图片，不要四宫格，不要拼图，不要把多张图合成到一个文件里，不要在画面中展示其他备选图。"
  ].join("\n").trim();
}

function readImagePrompts(params: GenerationTaskPayload["params"]) {
  return Array.isArray(params.imagePrompts)
    ? params.imagePrompts.filter((prompt): prompt is string => typeof prompt === "string" && Boolean(prompt.trim()))
    : [];
}

function isSupportedReferenceImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"))
  );
}

function normalizeImageCount(value: unknown) {
  const count = Number(value ?? 1);
  return Number.isInteger(count) && count >= 1 && count <= 50 ? count : 1;
}

function normalizeResolution(value: unknown) {
  return value === "4k" ? "4k" : value === "2k" ? "2k" : "1k";
}

function normalizeDimensions(size: string, resolution: ReturnType<typeof normalizeResolution>) {
  const scale = resolution === "4k" ? 4 : resolution === "2k" ? 2 : 1;
  const pixelMatch = size.match(/^(\d{2,5})x(\d{2,5})$/);

  if (pixelMatch) {
    return Math.max(Number(pixelMatch[1]), Number(pixelMatch[2]));
  }

  return 1024 * scale;
}

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeNonNegativeInteger(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

async function mapWithConcurrency<T>(itemCount: number, concurrency: number, mapper: (index: number) => Promise<T>) {
  const results = new Array<T>(itemCount);
  let nextIndex = 0;
  let failure: unknown;

  async function run() {
    while (failure === undefined) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= itemCount) {
        return;
      }

      try {
        results[index] = await mapper(index);
      } catch (error) {
        failure = error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(itemCount, concurrency) }, () => run()));

  if (failure !== undefined) {
    throw failure;
  }

  return results;
}

function readProviderError(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const error = (responseBody as { error?: unknown }).error;

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }

  const data = (responseBody as { data?: unknown }).data;
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : responseBody;
  const nestedError = (source as { error?: unknown }).error;

  if (typeof nestedError === "string") {
    return nestedError;
  }

  if (nestedError && typeof nestedError === "object" && typeof (nestedError as { message?: unknown }).message === "string") {
    return (nestedError as { message: string }).message;
  }

  return null;
}

function summarizeProviderResponse(responseBody: unknown, providerTaskId: string | null): Prisma.InputJsonValue {
  const status = readTaskStatus(responseBody);
  const images = readNestedImages(responseBody);

  return {
    providerTaskId,
    status,
    imageCount: images.length
  } satisfies Prisma.InputJsonValue;
}

function summarizeProviderCalls(calls: SingleProviderCallResult[]): Prisma.InputJsonValue {
  return {
    callCount: calls.length,
    calls: calls.map((call) => ({
      imageIndex: call.imageIndex + 1,
      durationMs: call.durationMs,
      statusCode: call.statusCode,
      providerTaskId: call.providerTaskId
    })),
    providerTaskIds: calls.map((call) => call.providerTaskId).filter((taskId): taskId is string => Boolean(taskId)),
    prompts: calls.map((call) => call.prompt),
    responses: calls.map((call) => summarizeProviderResponse(call.responseBody, call.providerTaskId ?? null)),
    imageCount: calls.reduce((total, call) => total + call.images.length, 0)
  } satisfies Prisma.InputJsonValue;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findWorkspaceRoot() {
  let current = process.cwd();

  while (true) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(current, "package.json"), "utf8")) as { name?: string };

      if (pkg.name === "ai-image-platform") {
        return current;
      }
    } catch {
      // Keep walking up until the workspace root is found.
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

function loadRootEnv() {
  for (const envPath of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")]) {
    try {
      const content = readFileSync(envPath, "utf8");

      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
          continue;
        }

        const equalsIndex = trimmed.indexOf("=");
        const name = trimmed.slice(0, equalsIndex).trim();
        const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");

        if (name && process.env[name] === undefined) {
          process.env[name] = value;
        }
      }
    } catch {
      // The worker can still run when env is injected by the parent process.
    }
  }
}

const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lJX9qAAAAABJRU5ErkJggg==";
