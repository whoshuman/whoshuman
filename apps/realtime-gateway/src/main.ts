import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";
import { envs } from "./config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: envs.natsServers,
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
      name: "realtime-gateway",
      queue: "realtime-gateway"
    }
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await app.startAllMicroservices();
  await app.listen(envs.port);
}

void bootstrap();
