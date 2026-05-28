import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { GenerationTasksModule } from "../generation-tasks/generation-tasks.module.js";
import { TemplatesController } from "./templates.controller.js";
import { TemplatesService } from "./templates.service.js";

@Module({
  imports: [AuthModule, GenerationTasksModule],
  controllers: [TemplatesController],
  providers: [TemplatesService]
})
export class TemplatesModule {}
