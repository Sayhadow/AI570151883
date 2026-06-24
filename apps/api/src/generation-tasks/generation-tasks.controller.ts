import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { RateLimitService } from "../rate-limit/rate-limit.service.js";
import type { CreateGenerationPlanInput, CreateGenerationTaskInput } from "./generation-tasks.service.js";
import { GenerationTasksService } from "./generation-tasks.service.js";

@Controller("generation-tasks")
export class GenerationTasksController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
    @Inject(GenerationTasksService) private readonly generationTasksService: GenerationTasksService
  ) {}

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    const user = await this.authService.getCurrentUser(request);

    if (user.agreementStatus !== "accepted") {
      throw new BadRequestException("Agreement must be accepted before creating generation tasks");
    }

    await this.rateLimitService.consume("generation.create.user", user.id, {
      max: 6,
      windowSeconds: 60
    });

    return this.generationTasksService.create(user.id, body as CreateGenerationTaskInput);
  }

  @Post("plan")
  async plan(@Req() request: Request, @Body() body: unknown) {
    const user = await this.authService.getCurrentUser(request);

    if (user.agreementStatus !== "accepted") {
      throw new BadRequestException("Agreement must be accepted before planning generation tasks");
    }

    await this.rateLimitService.consume("generation.plan.user", user.id, {
      max: 10,
      windowSeconds: 60
    });

    return this.generationTasksService.plan(body as CreateGenerationPlanInput);
  }

  @Get()
  async list(@Req() request: Request) {
    const user = await this.authService.getCurrentUser(request);
    return this.generationTasksService.listForUser(user.id);
  }

  @Get(":taskId")
  async get(@Req() request: Request, @Param("taskId") taskId: string) {
    const user = await this.authService.getCurrentUser(request);
    return this.generationTasksService.getForUser(user.id, taskId);
  }
}
