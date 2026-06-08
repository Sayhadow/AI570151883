import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { PointsService } from "./points.service.js";

@Controller("admin/users")
export class AdminUsersController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PointsService) private readonly pointsService: PointsService
  ) {}

  @Get()
  async list(@Req() request: Request) {
    await this.authService.requireAdmin(request);
    return this.pointsService.listAdminUsers();
  }

  @Post(":userId/points")
  async grantPoints(
    @Req() request: Request,
    @Param("userId") userId: string,
    @Body() body: unknown
  ) {
    const admin = await this.authService.requireAdmin(request);
    const input = body as { amount?: number; reason?: string };

    return this.pointsService.grantPoints(admin.id, userId, {
      amount: Number(input.amount),
      reason: input.reason
    });
  }
}
