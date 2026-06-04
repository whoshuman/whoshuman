import { Injectable } from "@nestjs/common";
import { AuthSubjects } from "@whoshuman/shared-events";
import type { AuthTokenPayload, AuthVerifyResponse } from "@whoshuman/shared-types";
import { MessagingService } from "../common/messaging.service";
import type { RealtimeSocket } from "./realtime.types";

@Injectable()
export class RealtimeAuthService {
  constructor(private readonly messaging: MessagingService) {}

  async verifySocket(socket: RealtimeSocket): Promise<AuthTokenPayload> {
    const token = this.extractToken(socket);

    if (!token) {
      throw new Error("Authentication token is required");
    }

    const result = await this.messaging.request<AuthVerifyResponse>(AuthSubjects.verify, { token });

    if (!result.valid || !result.payload) {
      throw new Error("Authentication token is invalid or expired");
    }

    return result.payload;
  }

  private extractToken(socket: RealtimeSocket): string | undefined {
    const authToken = this.readStringProperty(socket.handshake.auth, "token");
    if (authToken) return authToken;

    const queryToken = this.readStringProperty(socket.handshake.query, "token");
    if (queryToken) return queryToken;

    return this.extractBearerToken(socket.handshake.headers.authorization);
  }

  private readStringProperty(source: unknown, key: string): string | undefined {
    if (!this.isRecord(source)) return undefined;

    const value = source[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private extractBearerToken(header: string | undefined): string | undefined {
    const [scheme, token] = header?.split(" ") ?? [];
    return scheme === "Bearer" && token ? token : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
