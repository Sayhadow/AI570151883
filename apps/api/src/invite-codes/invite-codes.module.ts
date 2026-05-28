import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { InviteCodesController } from "./invite-codes.controller.js";
import { InviteCodesService } from "./invite-codes.service.js";

@Module({
  imports: [AuthModule],
  controllers: [InviteCodesController],
  providers: [InviteCodesService]
})
export class InviteCodesModule {}

