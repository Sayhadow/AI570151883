import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { AssetsService } from "./assets.service.js";

@Controller("assets")
export class AssetsController {
  constructor(
    private readonly authService: AuthService,
    private readonly assetsService: AssetsService
  ) {}

  @Get("results")
  async results(@Req() request: Request) {
    const user = await this.authService.getCurrentUser(request);
    return this.assetsService.listResultAssets(user.id);
  }
}
