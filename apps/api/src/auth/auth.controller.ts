import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { RateLimitService } from "../rate-limit/rate-limit.service.js";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService
  ) {}

  @Post("register")
  async register(@Req() request: Request, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    await this.rateLimitService.consume("auth.register.ip", this.rateLimitService.getClientIp(request), {
      max: 5,
      windowSeconds: 300
    });

    return this.authService.register(body as Record<string, string>, response);
  }

  @Post("login")
  async login(@Req() request: Request, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    await this.rateLimitService.consume("auth.login.ip", this.rateLimitService.getClientIp(request), {
      max: 10,
      windowSeconds: 60
    });

    return this.authService.login(body as Record<string, string>, response);
  }

  @Post("logout")
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request, response);
  }

  @Get("me")
  me(@Req() request: Request) {
    return this.authService.getCurrentUser(request);
  }

  @Post("agreement/accept")
  acceptAgreement(@Req() request: Request) {
    return this.authService.acceptAgreement(request);
  }
}
