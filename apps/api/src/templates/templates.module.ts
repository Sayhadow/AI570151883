import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { GenerationTasksModule } from "../generation-tasks/generation-tasks.module.js";
import { AdminTemplatesController, TemplatesController } from "./templates.controller.js";
import { TemplatesService } from "./templates.service.js";

@Module({
  imports: [AuthModule, GenerationTasksModule],
  controllers: [TemplatesController, AdminTemplatesController],
  providers: [TemplatesService]
})
export class TemplatesModule {}
