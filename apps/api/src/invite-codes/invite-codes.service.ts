import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { InviteCodeStatus } from "@ai-image/db";
import type { InviteCodeSummary } from "@ai-image/shared";
import { PrismaService } from "../prisma/prisma.service.js";

interface CreateInviteInput {
  code?: string;
  maxUses?: number;
  expiresAt?: string;
  note?: string;
}

@Injectable()
export class InviteCodesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<InviteCodeSummary[]> {
    const inviteCodes = await this.prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return inviteCodes.map((inviteCode) => ({
      id: inviteCode.id,
      code: inviteCode.code,
      status: this.toStatus(inviteCode.status),
      maxUses: inviteCode.maxUses,
      usedCount: inviteCode.usedCount,
      expiresAt: inviteCode.expiresAt?.toISOString() ?? null,
      note: inviteCode.note,
      createdAt: inviteCode.createdAt.toISOString()
    }));
  }

  async create(input: CreateInviteInput): Promise<InviteCodeSummary> {
    const code = (input.code?.trim() || this.generateCode()).toUpperCase();
    const maxUses = input.maxUses ?? 1;

    if (maxUses < 1 || maxUses > 100) {
      throw new BadRequestException("邀请码使用次数需在 1 到 100 之间");
    }

    const inviteCode = await this.prisma.inviteCode.create({
      data: {
        code,
        maxUses,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        note: input.note?.trim() || null
      }
    });

    return {
      id: inviteCode.id,
      code: inviteCode.code,
      status: this.toStatus(inviteCode.status),
      maxUses: inviteCode.maxUses,
      usedCount: inviteCode.usedCount,
      expiresAt: inviteCode.expiresAt?.toISOString() ?? null,
      note: inviteCode.note,
      createdAt: inviteCode.createdAt.toISOString()
    };
  }

  private generateCode() {
    return `TEST-${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  private toStatus(status: InviteCodeStatus): InviteCodeSummary["status"] {
    switch (status) {
      case InviteCodeStatus.ACTIVE:
        return "active";
      case InviteCodeStatus.USED:
        return "used";
      case InviteCodeStatus.DISABLED:
        return "disabled";
      case InviteCodeStatus.EXPIRED:
        return "expired";
    }
  }
}
