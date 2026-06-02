import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { I18nValidationExceptionFilter, I18nValidationPipe } from "nestjs-i18n";
import { AppModule } from "./app.module";
import { RpcToHttpExceptionFilter } from "./common";
import { envs } from "./config/envs";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set("trust proxy", 1);

  // I18nValidationPipe = ValidationPipe normal, pero capaz de traducir los mensajes
  // de error de los decoradores (los que usan i18nValidationMessage en los DTOs).
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  // Dos filtros, cada uno captura un tipo de error:
  //  - I18nValidationExceptionFilter: errores de validación de DTOs (400), traducidos.
  //  - RpcToHttpExceptionFilter: errores de los microservicios vía NATS.
  app.useGlobalFilters(
    new I18nValidationExceptionFilter({ detailedErrors: false }),
    new RpcToHttpExceptionFilter()
  );

  await app.listen(envs.port);
}

void bootstrap();
