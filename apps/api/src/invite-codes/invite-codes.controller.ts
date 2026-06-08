import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { InviteCodesService } from "./invite-codes.service.js";

@Controller("admin/invite-codes")
export class InviteCodesController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(InviteCodesService) private readonly inviteCodesService: InviteCodesService
  ) {}

  @Get()
  async list(@Req() request: Request) {
    await this.authService.requireAdmin(request);
    return this.inviteCodesService.list();
  }

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    await this.authService.requireAdmin(request);
    return this.inviteCodesService.create(body as Record<string, string | number>);
  }
}
