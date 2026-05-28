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

export type PointTransactionType =
  | "admin_grant"
  | "generation_hold"
  | "generation_capture"
  | "generation_refund"
  | "adjustment";

export type PointTransactionStatus = "pending" | "committed" | "reversed" | "failed";

export interface PointBalanceSummary {
  available: number;
  held: number;
  updatedAt: string | null;
}

export interface PointTransactionSummary {
  id: string;
  userId: string;
  taskId: string | null;
  relatedTransactionId: string | null;
  type: PointTransactionType;
  status: PointTransactionStatus;
  amount: number;
  balanceAfter: number | null;
  heldAfter: number | null;
  reason: string | null;
  createdAt: string;
  committedAt: string | null;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  agreementStatus: "pending" | "accepted";
  pointsAvailable: number;
  pointsHeld: number;
  createdAt: string;
}

export interface AdminPointGrantResponse {
  user: AdminUserSummary;
  transaction: PointTransactionSummary;
}

export interface GenerationTaskPayload {
  taskId: string;
  userId: string;
  prompt: string;
  negativePrompt: string | null;
  referenceAssetIds: string[];
  provider: AiProviderKey;
  pointHoldTransactionId: string;
}

export interface GenerationAssetSummary {
  id: string;
  kind: "reference" | "result" | "template_cover";
  bucket: string;
  objectKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface GenerationTaskSummary {
  id: string;
  prompt: string;
  negativePrompt: string | null;
  params: Record<string, unknown>;
  status: GenerationStatus;
  provider: AiProviderKey;
  pointCost: number;
  errorMessage: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assets: GenerationAssetSummary[];
}

export interface CreateGenerationTaskResponse {
  task: GenerationTaskSummary;
  pointHoldTransaction: PointTransactionSummary;
}

export interface ResultAssetSummary extends GenerationAssetSummary {
  taskId: string;
  prompt: string;
  negativePrompt: string | null;
  taskCreatedAt: string;
  taskCompletedAt: string | null;
}
