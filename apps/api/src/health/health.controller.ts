import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@ai-image/shared";

@Controller("health")
export class HealthController {
  @Get()
  health(): HealthStatus {
    return {
      service: "api",
      ok: true,
      timestamp: new Date().toISOString(),
      dependencies: {
        postgres: "unknown",
        redis: "unknown",
        storage: "unknown",
        aiProvider: "unknown"
      }
    };
  }
}

