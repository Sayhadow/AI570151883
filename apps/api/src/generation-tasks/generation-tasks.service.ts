import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import {
  Asset,
  AssetKind,
  GenerationTask,
  Prisma,
  ProviderKey,
  TaskStatus
} from "@ai-image/db";
import {
  GENERATION_QUEUE_NAME,
  type AiProviderKey,
  type CreateGenerationTaskResponse,
  type GenerationAssetSummary,
  type GenerationTaskPayload,
  type GenerationTaskSummary
} from "@ai-image/shared";
import { PointsService } from "../points/points.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface CreateGenerationTaskInput {
  prompt?: string;
  negativePrompt?: string;
  params?: unknown;
  provider?: string;
  pointCost?: number;
}

type TaskWithAssets = GenerationTask & {
  assets: Asset[];
};

@Injectable()
export class GenerationTasksService implements OnModuleDestroy {
  private readonly queue: Queue<GenerationTaskPayload>;
  private readonly defaultPointCost = this.normalizeConfiguredPointCost(
    Number(process.env.GENERATION_DEFAULT_POINT_COST ?? 10)
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService
  ) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    const parsedRedisUrl = new URL(redisUrl);

    this.queue = new Queue<GenerationTaskPayload>(process.env.GENERATION_QUEUE_NAME ?? GENERATION_QUEUE_NAME, {
      connection: {
        host: parsedRedisUrl.hostname,
        port: Number(parsedRedisUrl.port || 6379),
        username: parsedRedisUrl.username || undefined,
        password: parsedRedisUrl.password || undefined,
        maxRetriesPerRequest: null
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 100
      }
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async create(userId: string, input: CreateGenerationTaskInput): Promise<CreateGenerationTaskResponse> {
    const prompt = this.normalizePrompt(input.prompt);
    const negativePrompt = this.normalizeOptionalText(input.negativePrompt, 1000);
    const provider = this.normalizeProvider(input.provider);
    const pointCost = input.pointCost === undefined ? this.defaultPointCost : this.normalizePointCost(input.pointCost);
    const params = this.normalizeParams(input.params);

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.generationTask.create({
        data: {
          userId,
          prompt,
          negativePrompt,
          params,
          provider,
          pointCost,
          status: TaskStatus.QUEUED,
          queuedAt: new Date()
        },
        include: { assets: true }
      });

      const pointHoldTransaction = await this.pointsService.reserveGenerationPointsInTransaction(
        tx,
        userId,
        task.id,
        pointCost,
        "Generation task queued"
      );

      return { task, pointHoldTransaction };
    });

    try {
      const job = await this.queue.add(
        "generate-image",
        {
          taskId: created.task.id,
          userId,
          prompt,
          negativePrompt,
          referenceAssetIds: [],
          provider: this.toProviderKey(provider),
          pointHoldTransactionId: created.pointHoldTransaction.id
        },
        {
          jobId: created.task.id
        }
      );

      const task = await this.prisma.generationTask.update({
        where: { id: created.task.id },
        data: { providerTaskId: String(job.id) },
        include: { assets: true }
      });

      return {
        task: this.toTaskSummary(task),
        pointHoldTransaction: created.pointHoldTransaction
      };
    } catch (error) {
      await this.pointsService.refundGenerationHold(created.pointHoldTransaction.id, "Generation queue enqueue failed");
      await this.prisma.generationTask.update({
        where: { id: created.task.id },
        data: {
          status: TaskStatus.REFUNDED,
          errorMessage: error instanceof Error ? error.message : "Queue enqueue failed",
          completedAt: new Date()
        }
      });

      throw error;
    }
  }

  async listForUser(userId: string): Promise<GenerationTaskSummary[]> {
    const tasks = await this.prisma.generationTask.findMany({
      where: { userId },
      include: { assets: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return tasks.map((task) => this.toTaskSummary(task));
  }

  async getForUser(userId: string, taskId: string): Promise<GenerationTaskSummary> {
    const task = await this.prisma.generationTask.findFirst({
      where: { id: taskId, userId },
      include: { assets: true }
    });

    if (!task) {
      throw new NotFoundException("Generation task not found");
    }

    return this.toTaskSummary(task);
  }

  private normalizePrompt(prompt: string | undefined) {
    const normalized = prompt?.trim();

    if (!normalized) {
      throw new BadRequestException("Prompt is required");
    }

    if (normalized.length > 2000) {
      throw new BadRequestException("Prompt must be 2000 characters or less");
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | undefined, maxLength: number) {
    const normalized = value?.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(`Text must be ${maxLength} characters or less`);
    }

    return normalized;
  }

  private normalizeProvider(provider: string | undefined) {
    const normalized = provider?.trim().toLowerCase() || "mock";

    if (normalized !== "mock") {
      throw new BadRequestException("Only the mock provider is available");
    }

    return ProviderKey.MOCK;
  }

  private normalizePointCost(pointCost: number | undefined) {
    if (typeof pointCost !== "number" || !Number.isInteger(pointCost) || pointCost < 1 || pointCost > 10000) {
      throw new BadRequestException("Point cost must be an integer from 1 to 10000");
    }

    return pointCost;
  }

  private normalizeConfiguredPointCost(pointCost: number) {
    return Number.isInteger(pointCost) && pointCost > 0 ? pointCost : 10;
  }

  private normalizeParams(params: unknown): Prisma.InputJsonValue {
    if (params === undefined || params === null) {
      return {};
    }

    if (typeof params !== "object" || Array.isArray(params)) {
      throw new BadRequestException("Params must be an object");
    }

    return params as Prisma.InputJsonObject;
  }

  private toTaskSummary(task: TaskWithAssets): GenerationTaskSummary {
    return {
      id: task.id,
      prompt: task.prompt,
      negativePrompt: task.negativePrompt,
      status: this.toTaskStatus(task.status),
      provider: this.toProviderKey(task.provider),
      pointCost: task.pointCost,
      errorMessage: task.errorMessage,
      queuedAt: task.queuedAt?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      assets: task.assets.map((asset) => this.toAssetSummary(asset))
    };
  }

  private toAssetSummary(asset: Asset): GenerationAssetSummary {
    return {
      id: asset.id,
      kind: this.toAssetKind(asset.kind),
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt.toISOString()
    };
  }

  private toTaskStatus(status: TaskStatus): GenerationTaskSummary["status"] {
    switch (status) {
      case TaskStatus.DRAFT:
        return "draft";
      case TaskStatus.QUEUED:
        return "queued";
      case TaskStatus.PROCESSING:
        return "processing";
      case TaskStatus.SUCCEEDED:
        return "succeeded";
      case TaskStatus.FAILED:
        return "failed";
      case TaskStatus.REFUNDED:
        return "refunded";
    }
  }

  private toProviderKey(provider: ProviderKey): AiProviderKey {
    switch (provider) {
      case ProviderKey.MOCK:
        return "mock";
      case ProviderKey.PROVIDER_A:
        return "provider_a";
      case ProviderKey.PROVIDER_B:
        return "provider_b";
    }
  }

  private toAssetKind(kind: AssetKind): GenerationAssetSummary["kind"] {
    switch (kind) {
      case AssetKind.REFERENCE:
        return "reference";
      case AssetKind.RESULT:
        return "result";
      case AssetKind.TEMPLATE_COVER:
        return "template_cover";
    }
  }
}
