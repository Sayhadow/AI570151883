import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { AdminOpsService } from "./admin-ops.service.js";

@Controller("admin")
export class AdminOpsController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminOpsService: AdminOpsService
  ) {}

  @Get("overview")
  async overview(@Req() request: Request) {
    await this.authService.requireAdmin(request);
    return this.adminOpsService.getOverview();
  }

  @Get("tasks")
  async tasks(@Req() request: Request) {
    await this.authService.requireAdmin(request);
    return this.adminOpsService.listTasks();
  }
}
