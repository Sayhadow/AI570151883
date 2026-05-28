import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminUsersController } from "./admin-users.controller.js";
import { PointsController } from "./points.controller.js";
import { PointsService } from "./points.service.js";

@Module({
  imports: [AuthModule],
  controllers: [PointsController, AdminUsersController],
  providers: [PointsService],
  exports: [PointsService]
})
export class PointsModule {}
