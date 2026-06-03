import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * PrismaModule expone PrismaService a toda la aplicación.
 *
 * @Global() hace que PrismaService esté disponible en cualquier módulo
 * sin tener que importar PrismaModule explícitamente en cada uno.
 * Solo hace falta importarlo una vez en AppModule.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
