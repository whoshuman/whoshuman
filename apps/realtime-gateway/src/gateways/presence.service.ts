import { Injectable } from "@nestjs/common";

/**
 * Quién está conectado, en memoria. Cuenta SOCKETS por usuario (no un booleano):
 * con dos pestañas abiertas, cerrar una no debe dejar al usuario offline.
 */
// ponytail: en memoria y por instancia; si algún día hay varias réplicas del gateway,
// esto pasa a un store compartido (Redis) sin cambiar el contrato de eventos.
@Injectable()
export class PresenceService {
  private readonly sockets = new Map<string, number>();

  /** Registra un socket. Devuelve true si el usuario ACABA de ponerse online. */
  add(userId: string): boolean {
    const count = this.sockets.get(userId) ?? 0;
    this.sockets.set(userId, count + 1);
    return count === 0;
  }

  /** Da de baja un socket. Devuelve true si el usuario ACABA de quedarse offline. */
  remove(userId: string): boolean {
    const count = this.sockets.get(userId) ?? 0;
    if (count <= 1) {
      this.sockets.delete(userId);
      return count === 1;
    }
    this.sockets.set(userId, count - 1);
    return false;
  }

  /** userIds actualmente conectados. */
  list(): string[] {
    return [...this.sockets.keys()];
  }
}
