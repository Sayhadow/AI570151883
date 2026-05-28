export const GENERATION_QUEUE_NAME = "generation";

export const generationStatuses = [
  "draft",
  "queued",
  "processing",
  "succeeded",
  "failed",
  "refunded"
] as const;

export type GenerationStatus = (typeof generationStatuses)[number];

export type UserRole = "user" | "admin";

export type AiProviderKey = "mock" | "provider_a" | "provider_b";

export interface HealthStatus {
  service: string;
  ok: boolean;
  timestamp: string;
  dependencies?: Record<string, "ok" | "unknown" | "down">;
}

export interface GenerationTaskPayload {
  taskId: string;
  userId: string;
  prompt: string;
  referenceAssetIds: string[];
  provider: AiProviderKey;
  pointHoldTransactionId: string;
}

