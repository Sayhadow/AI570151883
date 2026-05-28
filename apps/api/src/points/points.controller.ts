import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { PointsService } from "./points.service.js";

@Controller("points")
export class PointsController {
  constructor(
    private readonly authService: AuthService,
    private readonly pointsService: PointsService
  ) {}

  @Get("balance")
  async balance(@Req() request: Request) {
    const user = await this.authService.getCurrentUser(request);
    return this.pointsService.getBalance(user.id);
  }

  @Get("transactions")
  async transactions(@Req() request: Request) {
    const user = await this.authService.getCurrentUser(request);
    return this.pointsService.listTransactions(user.id);
  }
}
