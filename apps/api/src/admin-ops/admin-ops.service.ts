import { Injectable } from "@nestjs/common";
import {
  GenerationTask,
  ProviderCallLog,
  ProviderKey,
  TaskStatus,
  User
} from "@ai-image/db";
import type {
  AdminGenerationTaskSummary,
  AdminOverviewSummary,
  AdminProviderCallSummary,
  AiProviderKey,
  GenerationStatus
} from "@ai-image/shared";
import { PrismaService } from "../prisma/prisma.service.js";

type AdminTaskRecord = GenerationTask & {
  user: Pick<User, "email" | "displayName">;
  providerCalls: ProviderCallLog[];
  _count: {
    assets: number;
    pointTransactions: number;
  };
};

@Injectable()
export class AdminOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AdminOverviewSummary> {
    const [
      totalUsers,
      totalTasks,
      queuedTasks,
      processingTasks,
      succeededTasks,
      refundedTasks,
      balanceTotals
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.generationTask.count(),
      this.prisma.generationTask.count({ where: { status: TaskStatus.QUEUED } }),
      this.prisma.generationTask.count({ where: { status: TaskStatus.PROCESSING } }),
      this.prisma.generationTask.count({ where: { status: TaskStatus.SUCCEEDED } }),
      this.prisma.generationTask.count({ where: { status: TaskStatus.REFUNDED } }),
      this.prisma.userBalance.aggregate({
        _sum: {
          available: true,
          held: true
        }
      })
    ]);

    return {
      totalUsers,
      totalTasks,
      queuedTasks,
      processingTasks,
      succeededTasks,
      refundedTasks,
      totalAvailablePoints: balanceTotals._sum.available ?? 0,
      totalHeldPoints: balanceTotals._sum.held ?? 0
    };
  }

  async listTasks(): Promise<AdminGenerationTaskSummary[]> {
    const tasks = await this.prisma.generationTask.findMany({
      include: {
        user: {
          select: {
            email: true,
            displayName: true
          }
        },
        providerCalls: {
          orderBy: { createdAt: "desc" },
          take: 1
        },
        _count: {
          select: {
            assets: true,
            pointTransactions: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return tasks.map((task) => this.toAdminTaskSummary(task));
  }

  private toAdminTaskSummary(task: AdminTaskRecord): AdminGenerationTaskSummary {
    return {
      id: task.id,
      userId: task.userId,
      userEmail: task.user.email,
      userDisplayName: task.user.displayName,
      prompt: task.prompt,
      status: this.toTaskStatus(task.status),
      provider: this.toProviderKey(task.provider),
      pointCost: task.pointCost,
      resultAssetCount: task._count.assets,
      pointTransactionCount: task._count.pointTransactions,
      errorMessage: task.errorMessage,
      queuedAt: task.queuedAt?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      latestProviderCall: task.providerCalls[0] ? this.toProviderCallSummary(task.providerCalls[0]) : null
    };
  }

  private toProviderCallSummary(providerCall: ProviderCallLog): AdminProviderCallSummary {
    return {
      id: providerCall.id,
      provider: this.toProviderKey(providerCall.provider),
      statusCode: providerCall.statusCode,
      durationMs: providerCall.durationMs,
      errorMessage: providerCall.errorMessage,
      createdAt: providerCall.createdAt.toISOString()
    };
  }

  private toTaskStatus(status: TaskStatus): GenerationStatus {
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
}
