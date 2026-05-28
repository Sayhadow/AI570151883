import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AgreementStatus,
  PointTransaction,
  PointTransactionStatus,
  PointTransactionType,
  Prisma,
  User,
  UserBalance,
  UserRole
} from "@ai-image/db";
import type {
  AdminPointGrantResponse,
  AdminUserSummary,
  PointBalanceSummary,
  PointTransactionSummary
} from "@ai-image/shared";
import { PrismaService } from "../prisma/prisma.service.js";

interface GrantPointsInput {
  amount?: number;
  reason?: string;
}

type UserWithBalance = User & {
  balance: UserBalance | null;
};

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string): Promise<PointBalanceSummary> {
    const balance = await this.ensureBalance(userId);
    return this.toBalanceSummary(balance);
  }

  async listTransactions(userId: string, limit = 50): Promise<PointTransactionSummary[]> {
    const transactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100)
    });

    return transactions.map((transaction) => this.toTransactionSummary(transaction));
  }

  async listAdminUsers(): Promise<AdminUserSummary[]> {
    const users = await this.prisma.user.findMany({
      include: { balance: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return users.map((user) => this.toAdminUserSummary(user));
  }

  async grantPoints(
    actorId: string,
    targetUserId: string,
    input: GrantPointsInput
  ): Promise<AdminPointGrantResponse> {
    const amount = this.normalizePositiveAmount(input.amount);
    const reason = this.normalizeReason(input.reason) ?? "Admin points grant";

    return this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        include: { balance: true }
      });

      if (!targetUser) {
        throw new NotFoundException("User not found");
      }

      const balance = await tx.userBalance.upsert({
        where: { userId: targetUserId },
        update: {
          available: { increment: amount }
        },
        create: {
          userId: targetUserId,
          available: amount,
          held: 0
        }
      });

      const transaction = await tx.pointTransaction.create({
        data: {
          userId: targetUserId,
          type: PointTransactionType.ADMIN_GRANT,
          status: PointTransactionStatus.COMMITTED,
          amount,
          balanceAfter: balance.available,
          heldAfter: balance.held,
          reason,
          metadata: { actorId } satisfies Prisma.InputJsonValue,
          committedAt: new Date()
        }
      });

      await tx.adminLog.create({
        data: {
          actorId,
          action: "POINTS_GRANT",
          targetType: "User",
          targetId: targetUserId,
          metadata: {
            amount,
            reason,
            transactionId: transaction.id
          } satisfies Prisma.InputJsonValue
        }
      });

      return {
        user: this.toAdminUserSummary({
          ...targetUser,
          balance
        }),
        transaction: this.toTransactionSummary(transaction)
      };
    });
  }

  async reserveGenerationPoints(userId: string, taskId: string, amount: number, reason?: string) {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    const normalizedReason = this.normalizeReason(reason) ?? "Generation point hold";

    return this.prisma.$transaction((tx) =>
      this.reserveGenerationPointsInTransaction(tx, userId, taskId, normalizedAmount, normalizedReason)
    );
  }

  async reserveGenerationPointsInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    taskId: string,
    amount: number,
    reason = "Generation point hold"
  ) {
    const normalizedAmount = this.normalizePositiveAmount(amount);
    const normalizedReason = this.normalizeReason(reason) ?? "Generation point hold";

    const existingHold = await tx.pointTransaction.findFirst({
      where: {
        userId,
        taskId,
        type: PointTransactionType.GENERATION_HOLD,
        status: PointTransactionStatus.PENDING
      }
    });

    if (existingHold) {
      return this.toTransactionSummary(existingHold);
    }

    await tx.userBalance.upsert({
      where: { userId },
      update: {},
      create: { userId, available: 0, held: 0 }
    });

    const updateResult = await tx.userBalance.updateMany({
      where: {
        userId,
        available: { gte: normalizedAmount }
      },
      data: {
        available: { decrement: normalizedAmount },
        held: { increment: normalizedAmount }
      }
    });

    if (updateResult.count !== 1) {
      throw new BadRequestException("Insufficient points");
    }

    const balance = await tx.userBalance.findUniqueOrThrow({
      where: { userId }
    });

    const transaction = await tx.pointTransaction.create({
      data: {
        userId,
        taskId,
        type: PointTransactionType.GENERATION_HOLD,
        status: PointTransactionStatus.PENDING,
        amount: -normalizedAmount,
        balanceAfter: balance.available,
        heldAfter: balance.held,
        reason: normalizedReason
      }
    });

    return this.toTransactionSummary(transaction);
  }

  async captureGenerationHold(holdTransactionId: string, reason?: string) {
    const normalizedReason = this.normalizeReason(reason) ?? "Generation points captured";

    return this.prisma.$transaction(async (tx) => {
      const hold = await this.getPendingHold(tx, holdTransactionId);
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
        throw new BadRequestException("Held points are not available");
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

      const transaction = await tx.pointTransaction.create({
        data: {
          userId: hold.userId,
          taskId: hold.taskId,
          relatedTransactionId: hold.id,
          type: PointTransactionType.GENERATION_CAPTURE,
          status: PointTransactionStatus.COMMITTED,
          amount: -amount,
          balanceAfter: balance.available,
          heldAfter: balance.held,
          reason: normalizedReason,
          committedAt: new Date()
        }
      });

      return this.toTransactionSummary(transaction);
    });
  }

  async refundGenerationHold(holdTransactionId: string, reason?: string) {
    const normalizedReason = this.normalizeReason(reason) ?? "Generation points refunded";

    return this.prisma.$transaction(async (tx) => {
      const hold = await this.getPendingHold(tx, holdTransactionId);
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
        throw new BadRequestException("Held points are not available");
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

      const transaction = await tx.pointTransaction.create({
        data: {
          userId: hold.userId,
          taskId: hold.taskId,
          relatedTransactionId: hold.id,
          type: PointTransactionType.GENERATION_REFUND,
          status: PointTransactionStatus.COMMITTED,
          amount,
          balanceAfter: balance.available,
          heldAfter: balance.held,
          reason: normalizedReason,
          committedAt: new Date()
        }
      });

      return this.toTransactionSummary(transaction);
    });
  }

  private async ensureBalance(userId: string) {
    return this.prisma.userBalance.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        available: 0,
        held: 0
      }
    });
  }

  private async getPendingHold(
    tx: Prisma.TransactionClient,
    holdTransactionId: string
  ): Promise<PointTransaction> {
    const hold = await tx.pointTransaction.findUnique({
      where: { id: holdTransactionId }
    });

    if (!hold || hold.type !== PointTransactionType.GENERATION_HOLD) {
      throw new NotFoundException("Point hold not found");
    }

    if (hold.status !== PointTransactionStatus.PENDING) {
      throw new BadRequestException("Point hold is already closed");
    }

    return hold;
  }

  private normalizePositiveAmount(amount: number | undefined): number {
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
      throw new BadRequestException("Point amount must be an integer from 1 to 1000000");
    }

    return amount;
  }

  private normalizeReason(reason: string | undefined) {
    const normalized = reason?.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length > 200) {
      throw new BadRequestException("Reason must be 200 characters or less");
    }

    return normalized;
  }

  private toBalanceSummary(balance: UserBalance): PointBalanceSummary {
    return {
      available: balance.available,
      held: balance.held,
      updatedAt: balance.updatedAt?.toISOString() ?? null
    };
  }

  private toAdminUserSummary(user: UserWithBalance): AdminUserSummary {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role === UserRole.ADMIN ? "admin" : "user",
      agreementStatus: user.agreementStatus === AgreementStatus.ACCEPTED ? "accepted" : "pending",
      pointsAvailable: user.balance?.available ?? 0,
      pointsHeld: user.balance?.held ?? 0,
      createdAt: user.createdAt.toISOString()
    };
  }

  private toTransactionSummary(transaction: PointTransaction): PointTransactionSummary {
    return {
      id: transaction.id,
      userId: transaction.userId,
      taskId: transaction.taskId,
      relatedTransactionId: transaction.relatedTransactionId,
      type: this.toTransactionType(transaction.type),
      status: this.toTransactionStatus(transaction.status),
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter,
      heldAfter: transaction.heldAfter,
      reason: transaction.reason,
      createdAt: transaction.createdAt.toISOString(),
      committedAt: transaction.committedAt?.toISOString() ?? null
    };
  }

  private toTransactionType(type: PointTransactionType): PointTransactionSummary["type"] {
    switch (type) {
      case PointTransactionType.ADMIN_GRANT:
        return "admin_grant";
      case PointTransactionType.GENERATION_HOLD:
        return "generation_hold";
      case PointTransactionType.GENERATION_CAPTURE:
        return "generation_capture";
      case PointTransactionType.GENERATION_REFUND:
        return "generation_refund";
      case PointTransactionType.ADJUSTMENT:
        return "adjustment";
    }
  }

  private toTransactionStatus(status: PointTransactionStatus): PointTransactionSummary["status"] {
    switch (status) {
      case PointTransactionStatus.PENDING:
        return "pending";
      case PointTransactionStatus.COMMITTED:
        return "committed";
      case PointTransactionStatus.REVERSED:
        return "reversed";
      case PointTransactionStatus.FAILED:
        return "failed";
    }
  }
}
