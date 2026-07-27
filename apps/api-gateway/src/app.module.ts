import * as path from "node:path";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AcceptLanguageResolver, I18nModule, QueryResolver } from "nestjs-i18n";
import { AuthModule } from "./auth/auth.module";
import { envs } from "./config";
import { FriendsModule } from "./friends/friends.module";
import { HelloController } from "./hello.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { NatsModule } from "./transports/nats.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    // i18n: carga las traducciones de src/i18n (dist/i18n en producción).
    // El idioma se decide, en orden: ?lang=xx en la URL > cabecera Accept-Language.
    // Si no se reconoce ninguno, cae a español (fallbackLanguage).
    I18nModule.forRoot({
      fallbackLanguage: "es",
      loaderOptions: {
        path: path.join(__dirname, "i18n"),
        watch: true
      },
      resolvers: [{ use: QueryResolver, options: ["lang"] }, AcceptLanguageResolver]
    }),
    ThrottlerModule.forRoot([
      {
        ttl: envs.rateLimitTtlMs,
        limit: envs.rateLimitMaxRequests
      }
    ]),
    NatsModule,
    AuthModule,
    FriendsModule,
    NotificationsModule,
    UsersModule
  ],
  controllers: [HelloController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
