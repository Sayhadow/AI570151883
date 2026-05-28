import { Worker } from "bullmq";
import { GENERATION_QUEUE_NAME, type GenerationTaskPayload } from "@ai-image/shared";

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
    const delayMs = Number(process.env.MOCK_PROVIDER_DELAY_MS ?? 2500);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return {
      taskId: job.data.taskId,
      provider: job.data.provider,
      imageObjectKey: `mock-results/${job.data.taskId}.png`,
      completedAt: new Date().toISOString()
    };
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Generation job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Generation job ${job?.id ?? "unknown"} failed`, error);
});

console.log(`Worker listening on queue "${queueName}"`);
