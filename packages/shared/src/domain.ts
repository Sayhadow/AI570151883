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
  generationTaskCount: number;
  resultAssetCount: number;
  lastTaskAt: string | null;
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
  params: Record<string, string | number | boolean | null | string[]>;
  referenceAssetIds: string[];
  provider: AiProviderKey;
  pointHoldTransactionId: string;
}

export interface GenerationAssetSummary {
  id: string;
  kind: "reference" | "result" | "template_cover";
  bucket: string;
  objectKey: string;
  contentUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface GenerationTaskSummary {
  id: string;
  templateId: string | null;
  templateTitle: string | null;
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

export interface GenerationPromptPlanResponse {
  mode: "manual" | "auto";
  source: "builtin" | "auto_placeholder";
  imagePrompts: string[];
}

export interface TemplateSummary {
  id: string;
  title: string;
  description: string | null;
  prompt: string;
  negativePrompt: string | null;
  defaultParams: Record<string, unknown>;
  isPublished: boolean;
  createdAt: string;
}

export interface ResultAssetSummary extends GenerationAssetSummary {
  taskId: string;
  prompt: string;
  negativePrompt: string | null;
  taskCreatedAt: string;
  taskCompletedAt: string | null;
}

export interface AdminProviderCallSummary {
  id: string;
  provider: AiProviderKey;
  statusCode: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface AdminGenerationTaskSummary {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  prompt: string;
  status: GenerationStatus;
  provider: AiProviderKey;
  pointCost: number;
  resultAssetCount: number;
  pointTransactionCount: number;
  errorMessage: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  latestProviderCall: AdminProviderCallSummary | null;
}

export interface AdminOverviewSummary {
  totalUsers: number;
  totalTasks: number;
  queuedTasks: number;
  processingTasks: number;
  succeededTasks: number;
  refundedTasks: number;
  totalAvailablePoints: number;
  totalHeldPoints: number;
}
