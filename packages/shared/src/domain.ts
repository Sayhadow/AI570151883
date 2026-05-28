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

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  agreementStatus: "pending" | "accepted";
  pointsAvailable: number;
  pointsHeld: number;
}

export interface HealthStatus {
  service: string;
  ok: boolean;
  timestamp: string;
  dependencies?: Record<string, "ok" | "unknown" | "down">;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface InviteCodeSummary {
  id: string;
  code: string;
  status: "active" | "used" | "disabled" | "expired";
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface GenerationTaskPayload {
  taskId: string;
  userId: string;
  prompt: string;
  referenceAssetIds: string[];
  provider: AiProviderKey;
  pointHoldTransactionId: string;
}
