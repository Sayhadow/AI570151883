import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    return this.authService.register(body as Record<string, string>, response);
  }

  @Post("login")
  login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
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

