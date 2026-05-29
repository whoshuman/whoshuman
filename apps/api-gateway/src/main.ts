import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RpcToHttpExceptionFilter } from "./common";
import { envs } from "./config/envs";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new RpcToHttpExceptionFilter());

  await app.listen(envs.port);
}

void bootstrap();
