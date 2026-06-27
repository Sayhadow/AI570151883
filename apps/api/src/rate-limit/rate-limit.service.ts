import { HttpException, HttpStatus, Injectable, OnModuleDestroy } from "@nestjs/common";
import type { Request } from "express";
import { Redis } from "ioredis";

type RateLimitOptions = {
  max: number;
  windowSeconds: number;
};

const consumeRateLimitScript = `
local current = redis.call("INCR", KEYS[1])
local ttl = redis.call("TTL", KEYS[1])
if ttl < 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor() {
    const redisUrl = process.env.RATE_LIMIT_REDIS_URL ?? process.env.REDIS_URL ?? "redis://localhost:6379";
    const parsedRedisUrl = new URL(redisUrl);

    this.redis = new Redis({
      host: parsedRedisUrl.hostname,
      port: Number(parsedRedisUrl.port || 6379),
      username: parsedRedisUrl.username || undefined,
      password: parsedRedisUrl.password || undefined,
      tls: parsedRedisUrl.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: 1
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async consume(bucket: string, identifier: string, options: RateLimitOptions) {
    const key = `rate:${this.normalizeKeyPart(bucket)}:${this.normalizeKeyPart(identifier)}`;
    const result = (await this.redis.eval(consumeRateLimitScript, 1, key, String(options.windowSeconds))) as [number, number];
    const count = Number(result[0]);
    const retryAfterSeconds = Math.max(1, Number(result[1]) || options.windowSeconds);

    if (count > options.max) {
      throw new HttpException(
        {
          message: "请求过于频繁，请稍后再试",
          retryAfterSeconds
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  getClientIp(request: Request) {
    const forwardedFor = request.headers["x-forwarded-for"];
    const firstForwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0];
    return firstForwardedIp?.trim() || request.ip || request.socket.remoteAddress || "unknown";
  }

  private normalizeKeyPart(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "unknown";
  }
}
