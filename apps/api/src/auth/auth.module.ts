import { Module } from "@nestjs/common";
import { RateLimitModule } from "../rate-limit/rate-limit.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

@Module({
  imports: [RateLimitModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
