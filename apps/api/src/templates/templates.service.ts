import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Template } from "@ai-image/db";
import type { CreateGenerationTaskResponse, TemplateSummary } from "@ai-image/shared";
import { GenerationTasksService, type CreateGenerationTaskInput } from "../generation-tasks/generation-tasks.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface RemixTemplateInput {
  prompt?: string;
  negativePrompt?: string;
  params?: unknown;
  pointCost?: number;
}

export interface AdminTemplateInput {
  title?: string;
  description?: string | null;
  prompt?: string;
  negativePrompt?: string | null;
  defaultParams?: unknown;
  isPublished?: boolean;
}

@Injectable()
export class TemplatesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GenerationTasksService) private readonly generationTasksService: GenerationTasksService
  ) {}

  async listPublished(): Promise<TemplateSummary[]> {
    const templates = await this.prisma.template.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "asc" },
      take: 100
    });

    return templates.map((template) => this.toTemplateSummary(template));
  }

  async listAdmin(): Promise<TemplateSummary[]> {
    const templates = await this.prisma.template.findMany({
      orderBy: [{ isPublished: "desc" }, { updatedAt: "desc" }],
      take: 200
    });

    return templates.map((template) => this.toTemplateSummary(template));
  }

  async getPublished(templateId: string): Promise<TemplateSummary> {
    const template = await this.findPublished(templateId);
    return this.toTemplateSummary(template);
  }

  async remix(userId: string, templateId: string, input: RemixTemplateInput): Promise<CreateGenerationTaskResponse> {
    const template = await this.findPublished(templateId);
    const remixPrompt = input.prompt?.trim();
    const prompt = remixPrompt ? `${template.prompt}\n\nRemix direction: ${remixPrompt}` : template.prompt;

    const createInput: CreateGenerationTaskInput = {
      templateId: template.id,
      prompt,
      negativePrompt: input.negativePrompt?.trim() || template.negativePrompt || undefined,
      params: input.params,
      pointCost: input.pointCost
    };

    return this.generationTasksService.create(userId, createInput);
  }

  async createAdmin(input: AdminTemplateInput): Promise<TemplateSummary> {
    const data = this.normalizeAdminTemplateInput(input);
    const template = await this.prisma.template.create({ data });

    return this.toTemplateSummary(template);
  }

  async updateAdmin(templateId: string, input: AdminTemplateInput): Promise<TemplateSummary> {
    await this.findAny(templateId);
    const data = this.normalizeAdminTemplateInput(input);
    const template = await this.prisma.template.update({
      where: { id: templateId },
      data
    });

    return this.toTemplateSummary(template);
  }

  async setPublished(templateId: string, isPublished: boolean): Promise<TemplateSummary> {
    await this.findAny(templateId);
    const template = await this.prisma.template.update({
      where: { id: templateId },
      data: { isPublished }
    });

    return this.toTemplateSummary(template);
  }

  private async findAny(templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    return template;
  }

  private async findPublished(templateId: string) {
    const template = await this.prisma.template.findFirst({
      where: {
        id: templateId,
        isPublished: true
      }
    });

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    return template;
  }

  private normalizeAdminTemplateInput(input: AdminTemplateInput): Prisma.TemplateCreateInput {
    const title = this.normalizeText(input.title, "Template title", 80);
    const prompt = this.normalizeText(input.prompt, "Template prompt", 6000);
    const description = this.normalizeOptionalText(input.description ?? undefined, 500);
    const negativePrompt = this.normalizeOptionalText(input.negativePrompt ?? undefined, 1000);

    return {
      title,
      description,
      prompt,
      negativePrompt,
      defaultParams: this.normalizeDefaultParams(input.defaultParams),
      isPublished: Boolean(input.isPublished)
    };
  }

  private normalizeDefaultParams(params: unknown): Prisma.InputJsonObject {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw new BadRequestException("Template params must be an object");
    }

    const record = params as Record<string, unknown>;
    const preset = this.normalizePreset(record.preset);
    const category = this.normalizeCategory(record.category, preset);
    const imageCount = this.normalizeImageCount(record.imageCount, preset);
    const resolution = record.resolution === "2k" ? "2k" : "1k";
    const defaultParams: Record<string, Prisma.InputJsonValue> = {
      category,
      preset,
      imageCount,
      resolution,
      tags: this.normalizeTags(record.tags),
      extraPrompt: this.normalizeOptionalUnknownText(record.extraPrompt, 1000) ?? "",
      previewUrl: this.normalizePreviewUrl(record.previewUrl)
    };

    if (preset === "ecommerce_main") {
      defaultParams.mainStyleId = this.normalizeMainStyleId(record.mainStyleId);
    }

    return defaultParams as Prisma.InputJsonObject;
  }

  private normalizePreset(value: unknown) {
    if (value === "ecommerce_suite" || value === "ecommerce_main" || value === "ecommerce_scene") {
      return value;
    }

    throw new BadRequestException("Template preset must be ecommerce_suite, ecommerce_main, or ecommerce_scene");
  }

  private normalizeCategory(value: unknown, preset: string) {
    if (value === "suite" || value === "main" || value === "scene" || value === "detail" || value === "promotion") {
      return value;
    }

    if (preset === "ecommerce_main") {
      return "main";
    }

    if (preset === "ecommerce_scene") {
      return "scene";
    }

    return "suite";
  }

  private normalizeImageCount(value: unknown, preset: string) {
    const imageCount = Number(value);
    const allowedCounts =
      preset === "ecommerce_main" ? [1, 3, 5, 10, 20, 50] : preset === "ecommerce_scene" ? [1, 3, 5, 10] : [3, 5, 10];

    if (!Number.isInteger(imageCount) || !allowedCounts.includes(imageCount)) {
      throw new BadRequestException(`Template image count must be one of ${allowedCounts.join(", ")}`);
    }

    return imageCount;
  }

  private normalizeMainStyleId(value: unknown) {
    const normalized = typeof value === "string" && value.trim() ? value.trim() : "premium_minimal";
    const allowedStyleIds = new Set([
      "premium_minimal",
      "luxury_display",
      "fresh_bright",
      "high_contrast",
      "future_tech",
      "soft_home",
      "japanese_simple",
      "cream_healing",
      "natural_wood",
      "black_gold",
      "premium_gray",
      "white_studio",
      "brand_poster",
      "high_click",
      "social_seeding",
      "youth_trend",
      "oriental_elegance",
      "outdoor_energy",
      "festival_promotion",
      "creative_visual"
    ]);

    if (!allowedStyleIds.has(normalized)) {
      throw new BadRequestException("Unknown template main image style");
    }

    return normalized;
  }

  private normalizeTags(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  private normalizePreviewUrl(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      return "";
    }

    const normalized = value.trim();
    if (normalized.length > 1000) {
      throw new BadRequestException("Preview URL must be 1000 characters or less");
    }

    if (!/^https?:\/\//.test(normalized) && !normalized.startsWith("/")) {
      throw new BadRequestException("Preview URL must be an absolute URL or local path");
    }

    return normalized;
  }

  private normalizeText(value: string | undefined, label: string, maxLength: number) {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException(`${label} is required`);
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(`${label} must be ${maxLength} characters or less`);
    }

    return normalized;
  }

  private normalizeOptionalUnknownText(value: unknown, maxLength: number) {
    return typeof value === "string" ? this.normalizeOptionalText(value, maxLength) : null;
  }

  private normalizeOptionalText(value: string | null | undefined, maxLength: number) {
    const normalized = value?.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(`Text must be ${maxLength} characters or less`);
    }

    return normalized;
  }

  private toTemplateSummary(template: Template): TemplateSummary {
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      prompt: template.prompt,
      negativePrompt: template.negativePrompt,
      defaultParams: this.toRecord(template.defaultParams),
      isPublished: template.isPublished,
      createdAt: template.createdAt.toISOString()
    };
  }

  private toRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
