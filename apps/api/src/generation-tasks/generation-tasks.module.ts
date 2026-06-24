import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PointsModule } from "../points/points.module.js";
import { RateLimitModule } from "../rate-limit/rate-limit.module.js";
import { GenerationTasksController } from "./generation-tasks.controller.js";
import { GenerationTasksService } from "./generation-tasks.service.js";

@Module({
  imports: [AuthModule, PointsModule, RateLimitModule],
  controllers: [GenerationTasksController],
  providers: [GenerationTasksService],
  exports: [GenerationTasksService]
})
export class GenerationTasksModule {}
