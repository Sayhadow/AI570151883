import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import {
  Asset,
  AssetKind,
  GenerationTask,
  Prisma,
  ProviderKey,
  Template,
  TaskStatus
} from "@ai-image/db";
import {
  GENERATION_QUEUE_NAME,
  type AiProviderKey,
  type CreateGenerationTaskResponse,
  type GenerationAssetSummary,
  type GenerationPromptPlanResponse,
  type GenerationTaskPayload,
  type GenerationTaskSummary
} from "@ai-image/shared";
import { PointsService } from "../points/points.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface CreateGenerationTaskInput {
  prompt?: string;
  negativePrompt?: string;
  params?: unknown;
  provider?: string;
  pointCost?: number;
  templateId?: string;
}

export interface CreateGenerationPlanInput {
  mode?: string;
  params?: unknown;
}

type TaskWithAssets = GenerationTask & {
  assets: Asset[];
  template?: Pick<Template, "title"> | null;
};

const ecommerceSuiteDirections = [
  "高级感产品展示图。主体居中，干净电商背景，突出产品外观、轮廓、颜色和整体质感，适合作为商品主图。",
  "材质细节图。展示产品材质、纹理、边缘、结构、接口或关键部件，画面要像电商详情页里的细节卖点图。",
  "使用场景图。把产品放进真实使用环境，展示使用方式、尺寸关系和生活化场景，画面高级、干净、有购买欲。",
  "卖点说明图。围绕核心功能做视觉化表达，可加入简洁中文卖点文字，突出用户最关心的价值点。",
  "平台首图备选。做一张适合拼多多/淘宝/抖音电商的高点击主图，产品清晰，背景明亮，卖点直接。",
  "功能拆解图。展示产品关键功能模块和使用步骤，构图清楚，适合放入详情页。",
  "尺寸比例图。通过手持、桌面、手机等参照物体现产品尺寸和适配范围，避免夸张变形。",
  "包装感展示图。生成更像品牌商品图的视觉，适合搭配包装、配件、礼品感或套装感。",
  "社媒种草图。画面更有生活方式氛围，适合小红书、抖音封面或内容种草。",
  "转化卖点图。强调痛点解决、核心优势和购买理由，适合详情页收尾或广告投放。"
];

const ecommerceSceneDirections = [
  "核心使用场景。选择最典型、最容易理解产品用途的环境，清晰展示产品如何被使用。",
  "居家日常场景。放入整洁舒适的家庭空间，突出生活化、便利性和自然使用状态。",
  "桌面或办公场景。使用简洁桌面、书桌或办公环境，体现产品尺寸、摆放和功能价值。",
  "近景互动场景。通过手持、操作或局部互动体现使用方式，保持产品结构准确。",
  "空间氛围场景。使用更有设计感的环境和自然光，强化产品融入空间后的视觉质感。",
  "轻户外或出行场景。在合理适用时展示携带、移动或出行使用方式，避免不符合产品属性的场景。",
  "多人或家庭场景。在合理适用时表现用户关系和真实生活状态，产品仍然是画面核心。",
  "收纳与摆放场景。展示产品不使用时的摆放、收纳或陈列效果，画面简洁有秩序。",
  "社媒种草场景。使用更有生活方式感的构图，适合小红书或抖音内容封面。",
  "高转化详情场景。把使用痛点和解决效果表达清楚，适合详情页中段或广告投放。"
];

const ecommerceMainStyles = [
  { id: "premium_minimal", label: "高级极简", prompt: "干净留白、浅色高级背景、柔和商业摄影光线，突出产品轮廓、比例和材质。" },
  { id: "luxury_display", label: "轻奢陈列", prompt: "精品展台式陈列，画面简洁而有层次，强调高级质感和购买欲。" },
  { id: "fresh_bright", label: "清新明亮", prompt: "明快舒适的色彩和轻盈背景，主体清晰，适合大众电商平台首图。" },
  { id: "high_contrast", label: "高对比质感", prompt: "使用有层次的明暗关系和克制高级背景，强化产品质感与视觉冲击力。" },
  { id: "future_tech", label: "科技未来", prompt: "现代、克制、干净的科技感视觉，精致光线，强调产品功能和结构。" },
  { id: "soft_home", label: "柔和家居", prompt: "自然柔光、舒适家居氛围和细腻质感，保留清晰的电商主图主体。" },
  { id: "japanese_simple", label: "日系简约", prompt: "低饱和配色、整洁构图和安静留白，视觉清爽自然。" },
  { id: "cream_healing", label: "奶油治愈", prompt: "柔软奶油色调、温和光影和治愈感陈设，产品依然是画面核心。" },
  { id: "natural_wood", label: "自然木质", prompt: "自然木纹材质与温暖环境，强调真实质感和生活方式气息。" },
  { id: "black_gold", label: "黑金奢华", prompt: "深色背景、克制金色点缀和高端商业光线，呈现奢华视觉。" },
  { id: "premium_gray", label: "高级灰", prompt: "中性灰阶、稳重构图和清晰层次，画面理性、专业、干净。" },
  { id: "white_studio", label: "纯白棚拍", prompt: "标准纯白电商棚拍背景，光线均匀，产品主体准确清晰。" },
  { id: "brand_poster", label: "品牌海报", prompt: "品牌广告视觉与精致构图，保留适当标题留白，产品突出。" },
  { id: "high_click", label: "平台高点击", prompt: "明亮直接、重点明确、产品清晰，适合拼多多、淘宝或抖音电商首图。" },
  { id: "social_seeding", label: "社媒种草", prompt: "生活方式内容感构图，适合小红书或抖音封面，同时保持产品可辨识度。" },
  { id: "youth_trend", label: "年轻潮流", prompt: "年轻活力配色和时尚商业构图，视觉醒目但不过度杂乱。" },
  { id: "oriental_elegance", label: "国风雅致", prompt: "东方审美、克制陈设与雅致色调，呈现安静高级的商业画面。" },
  { id: "outdoor_energy", label: "户外活力", prompt: "自然环境、明快光线和轻量动感，展示产品的活力与适用性。" },
  { id: "festival_promotion", label: "节日促销", prompt: "节庆氛围、醒目但克制的促销视觉，兼顾产品清晰度和转化表达。" },
  { id: "creative_visual", label: "创意视觉", prompt: "具有记忆点的商业构图和视觉表达，在创意前提下保持产品准确。" }
] as const;

const ecommerceMainVariations = [
  "正面居中视角，主体轮廓完整，背景保持克制。",
  "轻微俯拍视角，展示顶部结构与整体比例。",
  "轻微仰拍视角，增强产品存在感和立体感。",
  "三分之四侧前方视角，突出结构层次。",
  "另一侧三分之四视角，呈现不同但合理的产品面貌。",
  "主体偏左构图，右侧保留干净留白。",
  "主体偏右构图，左侧保留干净留白。",
  "近景构图，突出材质、边缘和精致细节。",
  "稍远景构图，体现完整产品与背景空间关系。",
  "低机位陈列构图，强调产品底部和稳定感。",
  "高机位陈列构图，保持产品比例准确。",
  "对角线构图，增加画面动势但不要倾斜产品。",
  "中心对称构图，画面稳定且适合平台首图。",
  "非对称平衡构图，使用留白强化视觉重点。",
  "柔和侧光构图，体现材质和自然阴影。",
  "柔和正面光构图，主体明亮清晰。",
  "轻量背光轮廓构图，保持产品正面细节可辨。",
  "展台式构图，使用简洁层次突出产品。",
  "轻量道具点缀构图，道具不得遮挡或改变产品。",
  "高转化主图构图，视觉重点直接、清晰、有购买欲。"
];

@Injectable()
export class GenerationTasksService implements OnModuleDestroy {
  private readonly queue: Queue<GenerationTaskPayload>;
  private readonly defaultPointCost = this.normalizeConfiguredPointCost(
    Number(process.env.GENERATION_DEFAULT_POINT_COST ?? 10)
  );

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PointsService) private readonly pointsService: PointsService
  ) {
    const redisUrl = process.env.REDIS_QUEUE_URL ?? process.env.REDIS_URL ?? "redis://localhost:6379";
    const parsedRedisUrl = new URL(redisUrl);

    this.queue = new Queue<GenerationTaskPayload>(process.env.GENERATION_QUEUE_NAME ?? GENERATION_QUEUE_NAME, {
      connection: {
        host: parsedRedisUrl.hostname,
        port: Number(parsedRedisUrl.port || 6379),
        username: parsedRedisUrl.username || undefined,
        password: parsedRedisUrl.password || undefined,
        tls: parsedRedisUrl.protocol === "rediss:" ? {} : undefined,
        maxRetriesPerRequest: null
      },
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 50 },
        removeOnFail: { age: 86400, count: 100 }
      }
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async create(userId: string, input: CreateGenerationTaskInput): Promise<CreateGenerationTaskResponse> {
    const template = input.templateId
      ? await this.prisma.template.findFirst({
          where: {
            id: input.templateId,
            isPublished: true
          }
        })
      : null;

    if (input.templateId && !template) {
      throw new NotFoundException("Template not found");
    }

    const params = this.mergeParams(template?.defaultParams, input.params);
    const paramsRecord = this.toRecord(params as Prisma.JsonValue);
    this.readSubmittedImagePrompts(paramsRecord.imagePrompts, paramsRecord.imageCount, this.readPreset(params));
    const prompt = this.normalizePrompt(this.resolvePrompt(input.prompt ?? template?.prompt, params));
    const negativePrompt = this.normalizeOptionalText(input.negativePrompt ?? template?.negativePrompt ?? undefined, 1000);
    const provider = this.normalizeProvider(input.provider);
    const pointCost = this.hasImageBillingParams(params)
      ? this.calculatePointCost(params)
      : input.pointCost === undefined
        ? this.defaultPointCost
        : this.normalizePointCost(input.pointCost);

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.generationTask.create({
        data: {
          userId,
          templateId: template?.id ?? null,
          prompt,
          negativePrompt,
          params,
          provider,
          pointCost,
          status: TaskStatus.QUEUED,
          queuedAt: new Date()
        },
        include: { assets: true, template: { select: { title: true } } }
      });

      const pointHoldTransaction = await this.pointsService.reserveGenerationPointsInTransaction(
        tx,
        userId,
        task.id,
        pointCost,
        "Generation task queued"
      );

      return { task, pointHoldTransaction };
    });

    try {
      const queueParams = this.buildQueueParams(params, prompt);
      const job = await this.queue.add(
        "generate-image",
        {
          taskId: created.task.id,
          userId,
          prompt,
          negativePrompt,
          params: queueParams,
          referenceAssetIds: [],
          provider: this.toProviderKey(provider),
          pointHoldTransactionId: created.pointHoldTransaction.id
        },
        {
          jobId: created.task.id
        }
      );

      const task = await this.prisma.generationTask.update({
        where: { id: created.task.id },
        data: { providerTaskId: String(job.id) },
        include: { assets: true, template: { select: { title: true } } }
      });

      return {
        task: this.toTaskSummary(task),
        pointHoldTransaction: created.pointHoldTransaction
      };
    } catch (error) {
      await this.pointsService.refundGenerationHold(created.pointHoldTransaction.id, "Generation queue enqueue failed");
      await this.prisma.generationTask.update({
        where: { id: created.task.id },
        data: {
          status: TaskStatus.REFUNDED,
          errorMessage: error instanceof Error ? error.message : "Queue enqueue failed",
          completedAt: new Date()
        }
      });

      throw error;
    }
  }

  async listForUser(userId: string): Promise<GenerationTaskSummary[]> {
    const tasks = await this.prisma.generationTask.findMany({
      where: { userId },
      include: { assets: true, template: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return tasks.map((task) => this.toTaskSummary(task));
  }

  async getForUser(userId: string, taskId: string): Promise<GenerationTaskSummary> {
    const task = await this.prisma.generationTask.findFirst({
      where: { id: taskId, userId },
      include: { assets: true, template: { select: { title: true } } }
    });

    if (!task) {
      throw new NotFoundException("Generation task not found");
    }

    return this.toTaskSummary(task);
  }

  plan(input: CreateGenerationPlanInput): GenerationPromptPlanResponse {
    const params = this.normalizeParams(input.params);

    if (this.readPreset(params) !== "ecommerce_suite") {
      throw new BadRequestException("Prompt planning is currently available for ecommerce suite mode only");
    }

    const mode = this.normalizeSuitePlanningMode(input.mode);
    const prompt = this.normalizePrompt(this.resolvePrompt(undefined, params));

    return {
      mode,
      source: mode === "auto" ? "auto_placeholder" : "builtin",
      imagePrompts: this.buildImagePrompts(prompt, params)
    };
  }

  private normalizePrompt(prompt: string | undefined) {
    const normalized = prompt?.trim();

    if (!normalized) {
      throw new BadRequestException("Prompt is required");
    }

    if (normalized.length > 6000) {
      throw new BadRequestException("Prompt must be 6000 characters or less");
    }

    return normalized;
  }

  private resolvePrompt(prompt: string | undefined, params: Prisma.InputJsonValue) {
    switch (this.readPreset(params)) {
      case "ecommerce_suite":
        return this.buildEcommerceSuitePrompt(params);
      case "ecommerce_main":
        return this.buildEcommerceMainPrompt(params);
      case "ecommerce_scene":
        return this.buildEcommerceScenePrompt(params);
      default:
        return this.addProductNameToPrompt(prompt, params);
    }
  }

  private readPreset(params: Prisma.InputJsonValue) {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return null;
    }

    const preset = (params as Record<string, unknown>).preset;
    return typeof preset === "string" ? preset : null;
  }

  private addProductNameToPrompt(prompt: string | undefined, params: Prisma.InputJsonValue) {
    if (!prompt || !params || typeof params !== "object" || Array.isArray(params)) {
      return prompt;
    }

    const productNameLine = this.buildProductNamePromptLine((params as Record<string, unknown>).productName);
    return productNameLine ? `${prompt.trim()}\n${productNameLine}` : prompt;
  }

  private buildProductNamePromptLine(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const productName = value.trim();

    if (!productName) {
      return null;
    }

    if (productName.length > 100) {
      throw new BadRequestException("Product name must be 100 characters or less");
    }

    return `产品名称：${productName}。请在理解商品用途和画面表达时使用该产品名，但不要生成错误文字或乱码。`;
  }

  private buildEcommerceSuitePrompt(params: Prisma.InputJsonValue) {
    const record = params && typeof params === "object" && !Array.isArray(params) ? (params as Record<string, unknown>) : {};
    const imageCount = this.normalizeImageCountForBilling(record.imageCount, "ecommerce_suite");
    const extraPrompt = typeof record.extraPrompt === "string" && record.extraPrompt.trim() ? record.extraPrompt.trim() : "无";
    const productNameLine = this.buildProductNamePromptLine(record.productName);

    return [
      "你是资深电商视觉设计师和商品摄影师。请根据参考图顺位1中的产品，生成一组独立的电商套图。",
      productNameLine,
      "通用要求：每次只生成一张完整图片；不要拼图、不要四宫格、不要多图合成；产品主体必须清晰可辨，尽量保持参考图产品的形态、颜色、结构和材质；画面适合电商平台使用。",
      "产品与光影要求：注意产品不要发生形变，注意正确的光影关系。",
      "风格要求：高级感、商业摄影、干净背景、光影自然、构图稳定、不要杂乱环境、不要水印、不要低清晰度。",
      `本次需要生成 ${imageCount} 张独立图片，分别按以下方向执行：`,
      ...ecommerceSuiteDirections.slice(0, imageCount).map((direction, index) => `第 ${index + 1} 张：${direction}`),
      `用户额外补充要求：${extraPrompt}`
    ].join("\n");
  }

  private buildEcommerceMainPrompt(params: Prisma.InputJsonValue) {
    const record = params && typeof params === "object" && !Array.isArray(params) ? (params as Record<string, unknown>) : {};
    const imageCount = this.normalizeImageCountForBilling(record.imageCount, "ecommerce_main");
    const extraPrompt = typeof record.extraPrompt === "string" && record.extraPrompt.trim() ? record.extraPrompt.trim() : "无";
    const style = this.readEcommerceMainStyle(record.mainStyleId);
    const productNameLine = this.buildProductNamePromptLine(record.productName);

    return [
      "你是资深电商主图设计师和商品摄影师。请根据参考图中的产品，生成一组视觉风格统一但画面表达不同的独立电商主图。",
      productNameLine,
      "通用要求：每次只生成一张完整图片；不要拼图、不要四宫格、不要多图合成；产品必须清晰可辨；尽量保持参考图产品的形态、颜色、结构和材质；不要凭空增加不存在的配件；不要水印；不要低清晰度。",
      "产品与光影要求：注意产品不要发生形变，注意正确的光影关系。",
      `选定风格：${style.label}。${style.prompt}`,
      "主图要求：主体突出、构图稳定、商业摄影质感、背景干净、适合电商平台首页展示。整组图片必须保持选定风格一致，仅改变合理的视角、机位、构图、留白、光线方向或轻量陈设。",
      `本次需要生成 ${imageCount} 张同一风格但画面不同的独立主图。`,
      `用户额外补充要求：${extraPrompt}`
    ].join("\n");
  }

  private buildEcommerceScenePrompt(params: Prisma.InputJsonValue) {
    const record = params && typeof params === "object" && !Array.isArray(params) ? (params as Record<string, unknown>) : {};
    const imageCount = this.normalizeImageCountForBilling(record.imageCount, "ecommerce_scene");
    const extraPrompt = typeof record.extraPrompt === "string" && record.extraPrompt.trim() ? record.extraPrompt.trim() : "无";
    const productNameLine = this.buildProductNamePromptLine(record.productName);

    return [
      "你是资深电商场景图设计师和商品摄影师。请根据参考图中的产品，生成一组视觉风格统一但使用场景不同的独立电商场景图。",
      productNameLine,
      "通用要求：每次只生成一张完整图片；不要拼图、不要四宫格、不要多图合成；产品必须清晰可辨；尽量保持参考图产品的形态、颜色、结构和材质；不要凭空增加不存在的配件；不要水印；不要低清晰度。",
      "产品与光影要求：注意产品不要发生形变，注意正确的光影关系。",
      "统一风格要求：整组图片保持一致的商业摄影语言、色调、光线质感和品牌感，仅切换场景、构图或使用动作。",
      `本次需要生成 ${imageCount} 张独立场景图，分别按以下场景执行：`,
      ...ecommerceSceneDirections.slice(0, imageCount).map((direction, index) => `第 ${index + 1} 张：${direction}`),
      `用户额外补充要求：${extraPrompt}`
    ].join("\n");
  }

  private buildQueueParams(params: Prisma.InputJsonValue, prompt: string): GenerationTaskPayload["params"] {
    const record = this.toRecord(params as Prisma.JsonValue);

    return {
      ...(record as GenerationTaskPayload["params"]),
      imagePrompts: this.readSubmittedImagePrompts(record.imagePrompts, record.imageCount, this.readPreset(params)) ?? this.buildImagePrompts(prompt, params)
    };
  }

  private readSubmittedImagePrompts(value: unknown, imageCountValue: unknown, preset: string | null) {
    if (value === undefined) {
      return null;
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException("imagePrompts must be an array");
    }

    const imageCount = this.normalizeImageCountForBilling(imageCountValue, preset);

    if (value.length !== imageCount) {
      throw new BadRequestException(`imagePrompts must contain exactly ${imageCount} entries`);
    }

    return value.map((prompt, index) => {
      if (typeof prompt !== "string" || !prompt.trim()) {
        throw new BadRequestException(`imagePrompts entry ${index + 1} is required`);
      }

      if (prompt.length > 6000) {
        throw new BadRequestException(`imagePrompts entry ${index + 1} must be 6000 characters or less`);
      }

      return prompt;
    });
  }

  private normalizeSuitePlanningMode(mode: string | undefined) {
    if (mode === undefined || mode === "manual") {
      return "manual";
    }

    if (mode === "auto") {
      return "auto";
    }

    throw new BadRequestException("Suite planning mode must be manual or auto");
  }

  private buildImagePrompts(prompt: string, params: Prisma.InputJsonValue) {
    const record = params && typeof params === "object" && !Array.isArray(params) ? (params as Record<string, unknown>) : {};
    const preset = this.readPreset(params);
    const imageCount = this.normalizeImageCountForBilling(record.imageCount, preset);

    switch (preset) {
      case "ecommerce_suite":
        return ecommerceSuiteDirections
          .slice(0, imageCount)
          .map((direction, index) => this.buildIndependentImagePrompt(prompt, direction, index, imageCount));
      case "ecommerce_scene":
        return ecommerceSceneDirections
          .slice(0, imageCount)
          .map((direction, index) => this.buildIndependentImagePrompt(prompt, direction, index, imageCount));
      case "ecommerce_main":
        return Array.from({ length: imageCount }, (_, index) => {
          const variation = ecommerceMainVariations[index % ecommerceMainVariations.length];
          const round = Math.floor(index / ecommerceMainVariations.length) + 1;
          const target = [
            `保持选定风格不变。画面变化要求：${variation}`,
            round > 1 ? `这是第 ${round} 轮变化，请进一步调整背景细节、留白比例和合理机位，避免与同组其他图片重复。` : null
          ]
            .filter(Boolean)
            .join(" ");

          return this.buildIndependentImagePrompt(prompt, target, index, imageCount);
        });
      default:
        return Array.from({ length: imageCount }, (_, index) =>
          this.buildIndependentImagePrompt(
            prompt,
            "在遵守用户 Prompt 的前提下，使用与同组其他图片不同的合理构图、机位或画面细节。",
            index,
            imageCount
          )
        );
    }
  }

  private buildIndependentImagePrompt(prompt: string, target: string, index: number, imageCount: number) {
    return [
      prompt,
      "",
      `本次只生成第 ${index + 1} 张图片，共 ${imageCount} 张独立图片。`,
      `当前单张要求：${target}`,
      "强制要求：只输出一张完整图片，不要四宫格，不要拼图，不要把多张图合成到一个文件里，不要在画面中展示其他备选图。"
    ].join("\n");
  }

  private readEcommerceMainStyle(value: unknown) {
    const styleId = typeof value === "string" && value.trim() ? value.trim() : "premium_minimal";
    const style = ecommerceMainStyles.find((candidate) => candidate.id === styleId);

    if (!style) {
      throw new BadRequestException("Unknown ecommerce main image style");
    }

    return style;
  }

  private normalizeOptionalText(value: string | undefined, maxLength: number) {
    const normalized = value?.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(`Text must be ${maxLength} characters or less`);
    }

    return normalized;
  }

  private normalizeProvider(provider: string | undefined) {
    const normalized = provider?.trim().toLowerCase() || process.env.AI_PROVIDER?.trim().toLowerCase() || "mock";

    switch (normalized) {
      case "mock":
        return ProviderKey.MOCK;
      case "provider_a":
        return ProviderKey.PROVIDER_A;
      case "provider_b":
        return ProviderKey.PROVIDER_B;
      default:
        throw new BadRequestException("Provider must be mock, provider_a, or provider_b");
    }
  }

  private normalizePointCost(pointCost: number | undefined) {
    if (typeof pointCost !== "number" || !Number.isInteger(pointCost) || pointCost < 1 || pointCost > 10000) {
      throw new BadRequestException("Point cost must be an integer from 1 to 10000");
    }

    return pointCost;
  }

  private normalizeConfiguredPointCost(pointCost: number) {
    return Number.isInteger(pointCost) && pointCost > 0 ? pointCost : 10;
  }

  private calculatePointCost(params: Prisma.InputJsonValue) {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return this.defaultPointCost;
    }

    const record = params as Record<string, unknown>;
    const resolution = record.resolution === "4k" ? "4k" : record.resolution === "2k" ? "2k" : "1k";
    const normalizedImageCount = this.normalizeImageCountForBilling(record.imageCount, this.readPreset(params));
    const unitCost = resolution === "4k" ? 40 : resolution === "2k" ? 20 : 10;

    return unitCost * normalizedImageCount;
  }

  private normalizeImageCountForBilling(value: unknown, preset: string | null = null) {
    if (value === undefined || value === null) {
      return 1;
    }

    const requestedImageCount = Number(value ?? 1);
    const maxImageCount = preset === "ecommerce_main" ? 50 : 10;

    if (!Number.isInteger(requestedImageCount) || requestedImageCount < 1 || requestedImageCount > maxImageCount) {
      throw new BadRequestException(`Image count must be an integer from 1 to ${maxImageCount}`);
    }

    return requestedImageCount;
  }

  private hasImageBillingParams(params: Prisma.InputJsonValue) {
    return Boolean(
      params &&
        typeof params === "object" &&
        !Array.isArray(params) &&
        ("resolution" in params || "imageCount" in params)
    );
  }

  private normalizeParams(params: unknown): Prisma.InputJsonValue {
    if (params === undefined || params === null) {
      return {};
    }

    if (typeof params !== "object" || Array.isArray(params)) {
      throw new BadRequestException("Params must be an object");
    }

    return params as Prisma.InputJsonObject;
  }

  private mergeParams(defaultParams: Prisma.JsonValue | undefined, params: unknown): Prisma.InputJsonValue {
    const normalizedDefaults = this.toInputJsonObject(defaultParams ?? {});
    const normalizedParams = this.normalizeParams(params);

    if (normalizedParams && typeof normalizedParams === "object" && !Array.isArray(normalizedParams)) {
      const mergedParams: Prisma.InputJsonObject = {
        ...normalizedDefaults,
        ...(normalizedParams as Prisma.InputJsonObject)
      };

      return mergedParams;
    }

    return normalizedDefaults;
  }

  private toTaskSummary(task: TaskWithAssets): GenerationTaskSummary {
    return {
      id: task.id,
      templateId: task.templateId,
      templateTitle: task.template?.title ?? null,
      prompt: task.prompt,
      negativePrompt: task.negativePrompt,
      params: this.toRecord(task.params),
      status: this.toTaskStatus(task.status),
      provider: this.toProviderKey(task.provider),
      pointCost: task.pointCost,
      errorMessage: task.errorMessage,
      queuedAt: task.queuedAt?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      assets: task.assets.map((asset) => this.toAssetSummary(asset))
    };
  }

  private toAssetSummary(asset: Asset): GenerationAssetSummary {
    return {
      id: asset.id,
      kind: this.toAssetKind(asset.kind),
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      contentUrl: this.toAssetContentUrl(asset),
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt.toISOString()
    };
  }

  private toAssetContentUrl(asset: Asset) {
    if (asset.kind !== AssetKind.RESULT || asset.bucket !== "local") {
      return null;
    }

    return `/api/assets/results/${asset.id}/content`;
  }

  private toRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private toInputJsonObject(value: Prisma.JsonValue): Prisma.InputJsonObject {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Prisma.InputJsonObject;
    }

    return {};
  }

  private toTaskStatus(status: TaskStatus): GenerationTaskSummary["status"] {
    switch (status) {
      case TaskStatus.DRAFT:
        return "draft";
      case TaskStatus.QUEUED:
        return "queued";
      case TaskStatus.PROCESSING:
        return "processing";
      case TaskStatus.SUCCEEDED:
        return "succeeded";
      case TaskStatus.FAILED:
        return "failed";
      case TaskStatus.REFUNDED:
        return "refunded";
    }
  }

  private toProviderKey(provider: ProviderKey): AiProviderKey {
    switch (provider) {
      case ProviderKey.MOCK:
        return "mock";
      case ProviderKey.PROVIDER_A:
        return "provider_a";
      case ProviderKey.PROVIDER_B:
        return "provider_b";
    }
  }

  private toAssetKind(kind: AssetKind): GenerationAssetSummary["kind"] {
    switch (kind) {
      case AssetKind.REFERENCE:
        return "reference";
      case AssetKind.RESULT:
        return "result";
      case AssetKind.TEMPLATE_COVER:
        return "template_cover";
    }
  }
}
