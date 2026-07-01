import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "node:path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 3000);
  const host = config.get<string>("HOST", "0.0.0.0");
  const defaultWebOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.168.51:5173",
  ];
  const configuredWebOrigins = config.get<string>("WEB_ORIGIN", defaultWebOrigins.join(","));
  const webOrigins = new Set([
    ...defaultWebOrigins,
    ...configuredWebOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);

  app.setGlobalPrefix("api/v1");
  app.useBodyParser("json", { limit: "25mb" });
  app.useBodyParser("urlencoded", { limit: "25mb", extended: true });
  app.useStaticAssets(join(process.cwd(), "apps", "api", "uploads"), { prefix: "/uploads/" });
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || webOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port, host);
}

void bootstrap();
