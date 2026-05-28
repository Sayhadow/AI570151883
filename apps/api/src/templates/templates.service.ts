import { Injectable, NotFoundException } from "@nestjs/common";
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

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generationTasksService: GenerationTasksService
  ) {}

  async listPublished(): Promise<TemplateSummary[]> {
    const templates = await this.prisma.template.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "asc" },
      take: 100
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
