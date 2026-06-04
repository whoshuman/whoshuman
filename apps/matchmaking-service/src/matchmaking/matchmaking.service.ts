import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { MatchmakingSubjects } from "@whoshuman/shared-events";
import type {
  MatchFoundPayload,
  MatchmakingJoinQueuePayload,
  MatchmakingLeaveQueuePayload
} from "@whoshuman/shared-types";
import { MessagingService } from "../common/messaging.service";
import { envs } from "../config";

interface QueuedPlayer {
  userId: string;
  username: string;
  socketId: string;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly queues = new Map<string, QueuedPlayer[]>();

  constructor(private readonly messaging: MessagingService) {}

  async joinQueue(payload: MatchmakingJoinQueuePayload) {
    const lobbyId = this.normalizeId(payload.lobbyId);
    const player: QueuedPlayer = {
      userId: payload.userId,
      username: payload.username,
      socketId: payload.socketId
    };

    this.removePlayerFromAllQueues(player.userId, player.socketId);

    const queue = this.getQueue(lobbyId);
    queue.push(player);
    this.logger.log(`Player queued: user=${player.userId} lobby=${lobbyId} size=${queue.length}`);

    await this.createMatches(lobbyId);
  }

  leaveQueue(payload: MatchmakingLeaveQueuePayload) {
    const lobbyId = this.normalizeId(payload.lobbyId);
    const removed = this.removePlayerFromQueue(lobbyId, payload.userId, payload.socketId);

    if (removed) {
      this.logger.log(`Player left queue: user=${payload.userId} lobby=${lobbyId}`);
      return;
    }

    this.logger.debug(
      `Ignoring leave for non-queued player: user=${payload.userId} lobby=${lobbyId}`
    );
  }

  getQueueSize(lobbyId: string) {
    return this.queues.get(this.normalizeId(lobbyId))?.length ?? 0;
  }

  private async createMatches(lobbyId: string) {
    const queue = this.getQueue(lobbyId);

    while (queue.length >= envs.matchmakingMinPlayers) {
      const players = queue.splice(0, envs.matchmakingMinPlayers);
      const event: MatchFoundPayload = {
        lobbyId,
        gameId: randomUUID(),
        playerIds: players.map((player) => player.userId)
      };

      try {
        await this.messaging.publish(MatchmakingSubjects.matchFound, event);
        this.logger.log(`Match found: game=${event.gameId} lobby=${lobbyId}`);
      } catch (error) {
        queue.unshift(...players);
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to publish match found: ${message}`);
        return;
      }
    }

    this.deleteEmptyQueue(lobbyId);
  }

  private getQueue(lobbyId: string) {
    const currentQueue = this.queues.get(lobbyId);
    if (currentQueue) return currentQueue;

    const queue: QueuedPlayer[] = [];
    this.queues.set(lobbyId, queue);
    return queue;
  }

  private removePlayerFromAllQueues(userId: string, socketId: string) {
    for (const [lobbyId] of this.queues) {
      this.removePlayerFromQueue(lobbyId, userId, socketId);
    }
  }

  private removePlayerFromQueue(lobbyId: string, userId: string, socketId: string) {
    const queue = this.queues.get(lobbyId);
    if (!queue) return false;

    const initialSize = queue.length;

    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const player = queue[index];
      if (player.userId === userId || player.socketId === socketId) {
        queue.splice(index, 1);
      }
    }

    this.deleteEmptyQueue(lobbyId);

    return queue.length !== initialSize;
  }

  private deleteEmptyQueue(lobbyId: string) {
    if (this.queues.get(lobbyId)?.length === 0) {
      this.queues.delete(lobbyId);
    }
  }

  private normalizeId(value: string) {
    return value.trim();
  }
}
