import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * PrismaService envuelve el PrismaClient de Prisma como un provider de NestJS.
 *
 * Extiende PrismaClient para heredar todos sus métodos (this.user, this.session, etc.)
 * y a la vez se integra en el ciclo de vida de NestJS:
 *   - onModuleInit: abre la conexión a PostgreSQL cuando el módulo arranca.
 *   - onModuleDestroy: cierra la conexión limpiamente cuando la app se apaga.
 *
 * Así cualquier servicio puede inyectar PrismaService y usar la BD con tipos seguros.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
