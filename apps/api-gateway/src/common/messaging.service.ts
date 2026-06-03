import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { I18nContext } from "nestjs-i18n";
import { firstValueFrom, TimeoutError, timeout } from "rxjs";
import { NATS_SERVICE } from "../config";

// Tiempo máximo que esperamos la respuesta de un microservicio antes de cortar.
const REQUEST_TIMEOUT_MS = 3000;

/**
 * MessagingService centraliza la comunicación HTTP→NATS del gateway.
 *
 * Cualquier controller HTTP (auth, user, game...) lo inyecta y llama a request().
 * Se encarga de dos cosas que NO queremos repetir en cada controller:
 *   1. Aplicar un timeout a la llamada NATS.
 *   2. Traducir los errores del microservicio a errores HTTP correctos.
 *
 * Cuando un microservicio lanza RpcException({ statusCode, message }), ese objeto
 * viaja de vuelta por NATS y aquí lo recibimos como un error plano. Lo convertimos
 * en una HttpException con el código correcto (401, 409, etc.) para que el cliente
 * reciba una respuesta HTTP coherente.
 */
@Injectable()
export class MessagingService {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  async request<TResult>(pattern: string, data: unknown): Promise<TResult> {
    try {
      return await firstValueFrom(
        this.client.send<TResult>(pattern, data).pipe(timeout(REQUEST_TIMEOUT_MS))
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /** Traduce cualquier error de la llamada NATS a una HttpException apropiada y localizada. */
  private toHttpException(error: unknown): HttpException {
    // El microservicio no respondió a tiempo.
    if (error instanceof TimeoutError) {
      return new GatewayTimeoutException(this.translate("serviceUnavailable"));
    }

    // Ya es una excepción HTTP (p. ej. lanzada por nosotros mismos): la dejamos pasar.
    if (error instanceof HttpException) {
      return error;
    }

    // Error remoto del microservicio: { statusCode, message } enviado en su RpcException.
    // El `message` es una CLAVE de traducción (ej. "invalidCredentials"), no texto literal.
    if (typeof error === "object" && error !== null) {
      const { statusCode, message } = error as { statusCode?: number; message?: string };
      const status = typeof statusCode === "number" ? statusCode : HttpStatus.INTERNAL_SERVER_ERROR;
      return new HttpException(this.translate(message ?? "unexpected"), status);
    }

    // Cualquier otra cosa inesperada.
    return new InternalServerErrorException(this.translate("unexpected"));
  }

  /**
   * Traduce una clave (ej. "invalidCredentials") al idioma de la petición actual.
   *
   * I18nContext.current() obtiene el idioma de la petición en curso (Accept-Language o
   * ?lang) sin tener que pasarlo a mano. Si la clave no existe en los archivos de
   * traducción, devuelve la propia clave (así un mensaje literal nunca rompe nada).
   */
  private translate(key: string): string {
    const i18n = I18nContext.current();
    if (!i18n) return key;
    return i18n.t(`errors.${key}`, { defaultValue: key });
  }
}
