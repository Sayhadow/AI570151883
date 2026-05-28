import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminOpsController } from "./admin-ops.controller.js";
import { AdminOpsService } from "./admin-ops.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AdminOpsController],
  providers: [AdminOpsService]
})
export class AdminOpsModule {}
