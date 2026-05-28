import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
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
    PointsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
