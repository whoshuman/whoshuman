import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom, timeout } from "rxjs";
import { NATS_SERVICE } from "../config";

const PUBLISH_TIMEOUT_MS = 1000;

@Injectable()
export class MessagingService {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  async publish(pattern: string, data: unknown): Promise<void> {
    await firstValueFrom(this.client.emit(pattern, data).pipe(timeout(PUBLISH_TIMEOUT_MS)));
  }
}
