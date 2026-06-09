import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  const bodyLimit = process.env.API_BODY_LIMIT ?? "10mb";

  app.useBodyParser("json", { limit: bodyLimit });
  app.useBodyParser("urlencoded", { extended: true, limit: bodyLimit });
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true
  });

  app.setGlobalPrefix("api");
  await app.listen(port);
}

void bootstrap();
