import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import type { CreateGenerationTaskInput } from "./generation-tasks.service.js";
import { GenerationTasksService } from "./generation-tasks.service.js";

@Controller("generation-tasks")
export class GenerationTasksController {
  constructor(
    private readonly authService: AuthService,
    private readonly generationTasksService: GenerationTasksService
  ) {}

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    const user = await this.authService.getCurrentUser(request);

    if (user.agreementStatus !== "accepted") {
      throw new BadRequestException("Agreement must be accepted before creating generation tasks");
    }

    return this.generationTasksService.create(user.id, body as CreateGenerationTaskInput);
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
