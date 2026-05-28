import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminOpsModule } from "./admin-ops/admin-ops.module.js";
import { AssetsModule } from "./assets/assets.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { GenerationTasksModule } from "./generation-tasks/generation-tasks.module.js";
import { HealthController } from "./health/health.controller.js";
import { InviteCodesModule } from "./invite-codes/invite-codes.module.js";
import { PointsModule } from "./points/points.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    InviteCodesModule,
    PointsModule,
    GenerationTasksModule,
    AssetsModule,
    AdminOpsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
