import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import {
  AgreementStatus,
  InviteCodeStatus,
  Prisma,
  User,
  UserRole
} from "@ai-image/db";
import type { Request, Response } from "express";
import type { AuthResponse, AuthUser } from "@ai-image/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionExpiresAt,
  getSessionTokenFromCookie,
  hashSessionToken,
  setSessionCookie
} from "./session.js";

interface RegisterInput {
  email?: string;
  password?: string;
  displayName?: string;
  inviteCode?: string;
}

interface LoginInput {
  email?: string;
  password?: string;
}

type UserWithBalance = User & {
  balance: {
    available: number;
    held: number;
  } | null;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterInput, response: Response): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);
    const inviteCode = this.normalizeInviteCode(input.inviteCode);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const invite = await tx.inviteCode.findUnique({
          where: { code: inviteCode }
        });

        if (!invite) {
          throw new BadRequestException("邀请码不存在");
        }

        if (invite.status !== InviteCodeStatus.ACTIVE) {
          throw new BadRequestException("邀请码不可用");
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
          await tx.inviteCode.update({
            where: { id: invite.id },
            data: { status: InviteCodeStatus.EXPIRED }
          });
          throw new BadRequestException("邀请码已过期");
        }

        if (invite.usedCount >= invite.maxUses) {
          throw new BadRequestException("邀请码已被使用完");
        }

        const created = await tx.user.create({
          data: {
            email,
            displayName: input.displayName?.trim() || null,
            passwordHash: hashPassword(password),
            inviteCodeId: invite.id,
            balance: {
              create: {
                available: 0,
                held: 0
              }
            }
          },
          include: {
            balance: true
          }
        });

        const nextUsedCount = invite.usedCount + 1;
        await tx.inviteCode.update({
          where: { id: invite.id },
          data: {
            usedCount: nextUsedCount,
            status: nextUsedCount >= invite.maxUses ? InviteCodeStatus.USED : InviteCodeStatus.ACTIVE
          }
        });

        return created;
      });

      await this.createSession(user.id, response);
      return { user: this.toAuthUser(user) };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("邮箱已注册");
      }

      throw error;
    }
  }

  async login(input: LoginInput, response: Response): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { balance: true }
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("邮箱或密码错误");
    }

    await this.createSession(user.id, response);
    return { user: this.toAuthUser(user) };
  }

  async logout(request: Request, response: Response) {
    const token = getSessionTokenFromCookie(request.headers.cookie);

    if (token) {
      await this.prisma.session.deleteMany({
        where: { tokenHash: hashSessionToken(token) }
      });
    }

    clearSessionCookie(response);
    return { ok: true };
  }

  async getCurrentUser(request: Request): Promise<AuthUser> {
    const user = await this.getUserFromRequest(request);
    return this.toAuthUser(user);
  }

  async acceptAgreement(request: Request): Promise<AuthResponse> {
    const user = await this.getUserFromRequest(request);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { agreementStatus: AgreementStatus.ACCEPTED },
      include: { balance: true }
    });

    return { user: this.toAuthUser(updatedUser) };
  }

  async requireAdmin(request: Request) {
    const user = await this.getUserFromRequest(request);

    if (user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException("需要管理员权限");
    }

    return user;
  }

  private async getUserFromRequest(request: Request) {
    const token = getSessionTokenFromCookie(request.headers.cookie);

    if (!token) {
      throw new UnauthorizedException("未登录");
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          include: { balance: true }
        }
      }
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("登录已过期");
    }

    return session.user;
  }

  private async createSession(userId: string, response: Response) {
    const token = createSessionToken();

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt: getSessionExpiresAt()
      }
    });

    setSessionCookie(response, token);
  }

  private toAuthUser(user: UserWithBalance): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role === UserRole.ADMIN ? "admin" : "user",
      agreementStatus: user.agreementStatus === AgreementStatus.ACCEPTED ? "accepted" : "pending",
      pointsAvailable: user.balance?.available ?? 0,
      pointsHeld: user.balance?.held ?? 0
    };
  }

  private normalizeEmail(email: string | undefined) {
    const normalized = email?.trim().toLowerCase();

    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException("请输入有效邮箱");
    }

    return normalized;
  }

  private normalizePassword(password: string | undefined) {
    if (!password || password.length < 8) {
      throw new BadRequestException("密码至少需要 8 位");
    }

    return password;
  }

  private normalizeInviteCode(inviteCode: string | undefined) {
    const normalized = inviteCode?.trim().toUpperCase();

    if (!normalized) {
      throw new BadRequestException("请输入邀请码");
    }

    return normalized;
  }

  private isUniqueConstraintError(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
