import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { TemplatesService, type AdminTemplateInput, type RemixTemplateInput } from "./templates.service.js";

@Controller("templates")
export class TemplatesController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(TemplatesService) private readonly templatesService: TemplatesService
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

@Controller("admin/templates")
export class AdminTemplatesController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(TemplatesService) private readonly templatesService: TemplatesService
  ) {}

  @Get()
  async list(@Req() request: Request) {
    await this.authService.requireAdmin(request);
    return this.templatesService.listAdmin();
  }

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    await this.authService.requireAdmin(request);
    return this.templatesService.createAdmin(body as AdminTemplateInput);
  }

  @Post(":templateId")
  async update(@Req() request: Request, @Param("templateId") templateId: string, @Body() body: unknown) {
    await this.authService.requireAdmin(request);
    return this.templatesService.updateAdmin(templateId, body as AdminTemplateInput);
  }

  @Post(":templateId/publish")
  async publish(@Req() request: Request, @Param("templateId") templateId: string, @Body() body: unknown) {
    await this.authService.requireAdmin(request);
    const input = body as { isPublished?: boolean };
    return this.templatesService.setPublished(templateId, Boolean(input.isPublished));
  }
}
