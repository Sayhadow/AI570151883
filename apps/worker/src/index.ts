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

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const queueName = process.env.GENERATION_QUEUE_NAME ?? GENERATION_QUEUE_NAME;
const parsedRedisUrl = new URL(redisUrl);

const connection = {
  host: parsedRedisUrl.hostname,
  port: Number(parsedRedisUrl.port || 6379),
  username: parsedRedisUrl.username || undefined,
  password: parsedRedisUrl.password || undefined,
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

      const delayMs = Number(process.env.MOCK_PROVIDER_DELAY_MS ?? 2500);
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(delayMs) ? delayMs : 2500));

      if (job.data.prompt.toLowerCase().includes("[fail]")) {
        throw new Error("Mock provider failure requested by prompt");
      }

      const durationMs = Date.now() - startedAt.getTime();
      const completedAt = new Date();
      const bucket = process.env.S3_BUCKET ?? "ai-image-assets";
      const objectKey = `mock-results/${job.data.taskId}.png`;

      await prisma.$transaction(async (tx) => {
        await tx.asset.create({
          data: {
            userId: job.data.userId,
            taskId: job.data.taskId,
            kind: AssetKind.RESULT,
            bucket,
            objectKey,
            mimeType: "image/png",
            width: 1024,
            height: 1024,
            sizeBytes: 0
          }
        });

        await tx.generationTask.update({
          where: { id: job.data.taskId },
          data: {
            status: TaskStatus.SUCCEEDED,
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
              referenceAssetIds: job.data.referenceAssetIds
            } satisfies Prisma.InputJsonValue,
            responseMeta: {
              bucket,
              objectKey,
              mock: true
            } satisfies Prisma.InputJsonValue,
            statusCode: 200,
            durationMs
          }
        });
      });

      return {
        taskId: job.data.taskId,
        provider: job.data.provider,
        imageObjectKey: objectKey,
        completedAt: completedAt.toISOString()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mock provider failed";
      const durationMs = Date.now() - startedAt.getTime();

      await prisma.$transaction(async (tx) => {
        await refundGenerationHold(tx, job.data.pointHoldTransactionId);

        await tx.generationTask.update({
          where: { id: job.data.taskId },
          data: {
            status: TaskStatus.REFUNDED,
            errorMessage: message,
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
              referenceAssetIds: job.data.referenceAssetIds
            } satisfies Prisma.InputJsonValue,
            responseMeta: {
              error: message,
              mock: true
            } satisfies Prisma.InputJsonValue,
            durationMs,
            errorMessage: message
          }
        });
      });

      throw error;
    }
  },
  { connection }
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

  if (hold.status === PointTransactionStatus.COMMITTED) {
    return;
  }

  if (hold.status !== PointTransactionStatus.PENDING) {
    throw new Error("Point hold is already closed");
  }

  const amount = Math.abs(hold.amount);
  const updateResult = await tx.userBalance.updateMany({
    where: {
      userId: hold.userId,
      held: { gte: amount }
    },
    data: {
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
      status: PointTransactionStatus.COMMITTED,
      committedAt: new Date()
    }
  });

  await tx.pointTransaction.create({
    data: {
      userId: hold.userId,
      taskId: hold.taskId,
      relatedTransactionId: hold.id,
      type: PointTransactionType.GENERATION_CAPTURE,
      status: PointTransactionStatus.COMMITTED,
      amount: -amount,
      balanceAfter: balance.available,
      heldAfter: balance.held,
      reason: "Generation points captured",
      committedAt: new Date()
    }
  });
}

async function refundGenerationHold(tx: Prisma.TransactionClient, holdTransactionId: string) {
  const hold = await tx.pointTransaction.findUnique({
    where: { id: holdTransactionId }
  });

  if (!hold || hold.type !== PointTransactionType.GENERATION_HOLD) {
    throw new Error("Point hold not found");
  }

  if (hold.status === PointTransactionStatus.REVERSED) {
    return;
  }

  if (hold.status !== PointTransactionStatus.PENDING) {
    throw new Error("Point hold is already closed");
  }

  const amount = Math.abs(hold.amount);
  const updateResult = await tx.userBalance.updateMany({
    where: {
      userId: hold.userId,
      held: { gte: amount }
    },
    data: {
      available: { increment: amount },
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
      status: PointTransactionStatus.REVERSED,
      committedAt: new Date()
    }
  });

  await tx.pointTransaction.create({
    data: {
      userId: hold.userId,
      taskId: hold.taskId,
      relatedTransactionId: hold.id,
      type: PointTransactionType.GENERATION_REFUND,
      status: PointTransactionStatus.COMMITTED,
      amount,
      balanceAfter: balance.available,
      heldAfter: balance.held,
      reason: "Generation points refunded",
      committedAt: new Date()
    }
  });
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

console.log(`Worker listening on queue "${queueName}"`);
