import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PointsModule } from "../points/points.module.js";
import { GenerationTasksController } from "./generation-tasks.controller.js";
import { GenerationTasksService } from "./generation-tasks.service.js";

@Module({
  imports: [AuthModule, PointsModule],
  controllers: [GenerationTasksController],
  providers: [GenerationTasksService]
})
export class GenerationTasksModule {}
