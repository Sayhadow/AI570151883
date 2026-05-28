import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { TemplatesService, type RemixTemplateInput } from "./templates.service.js";

@Controller("templates")
export class TemplatesController {
  constructor(
    private readonly authService: AuthService,
    private readonly templatesService: TemplatesService
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const user = await this.authService.getCurrentUser(request);
    this.requireAcceptedAgreement(user.agreementStatus);
    return this.templatesService.listPublished();
  }

  @Get(":templateId")
  async get(@Req() request: Request, @Param("templateId") templateId: string) {
    const user = await this.authService.getCurrentUser(request);
    this.requireAcceptedAgreement(user.agreementStatus);
    return this.templatesService.getPublished(templateId);
  }

  @Post(":templateId/remix")
  async remix(@Req() request: Request, @Param("templateId") templateId: string, @Body() body: unknown) {
    const user = await this.authService.getCurrentUser(request);
    this.requireAcceptedAgreement(user.agreementStatus);
    return this.templatesService.remix(user.id, templateId, body as RemixTemplateInput);
  }

  private requireAcceptedAgreement(agreementStatus: string) {
    if (agreementStatus !== "accepted") {
      throw new BadRequestException("Agreement must be accepted before using templates");
    }
  }
}
