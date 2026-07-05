import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { MatchmakingSubjects } from "@whoshuman/shared-events";
import type {
  LobbyStatePayload,
  MatchFoundPayload,
  MatchmakingJoinQueuePayload,
  MatchmakingLeaveQueuePayload,
  PlayerRole
} from "@whoshuman/shared-types";
import { MessagingService } from "../common/messaging.service";
import { envs } from "../config";

interface QueuedPlayer {
  userId: string;
  username: string;
  socketId: string;
  ready: boolean;
}

interface Lobby {
  lobbyId: string;
  players: QueuedPlayer[];
}

type SetReadyEvent = {
  userId: string;
  lobbyId: string;
  ready: boolean;
};

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly lobbies = new Map<string, Lobby>();

  constructor(private readonly messaging: MessagingService) {}

  async joinQueue(payload: unknown) {
    if (!this.isJoinQueuePayload(payload)) {
      this.logger.warn("Ignoring joinQueue with invalid payload");
      return;
    }

    const lobbyId = this.normalizeId(payload.lobbyId);
    const player: QueuedPlayer = {
      userId: payload.userId,
      username: payload.username,
      socketId: payload.socketId,
      ready: false
    };

    this.removePlayerFromAllLobbies(player.userId, player.socketId);

    const lobby = this.getLobby(lobbyId);
    lobby.players.push(player);
    this.logger.log(
      `Player queued: user=${player.userId} lobby=${lobbyId} size=${lobby.players.length}`
    );

    await this.evaluate(lobby);
  }

  async leaveQueue(payload: unknown) {
    if (!this.isLeaveQueuePayload(payload)) {
      this.logger.warn("Ignoring leaveQueue with invalid payload");
      return;
    }

    const lobbyId = this.normalizeId(payload.lobbyId);
    const removed = this.removePlayerFromLobby(lobbyId, payload.userId, payload.socketId);

    if (!removed) {
      this.logger.debug(
        `Ignoring leave for non-queued player: user=${payload.userId} lobby=${lobbyId}`
      );
      return;
    }

    this.logger.log(`Player left queue: user=${payload.userId} lobby=${lobbyId}`);
    const lobby = this.lobbies.get(lobbyId);
    if (lobby) await this.evaluate(lobby);
  }

  async setReady(payload: unknown) {
    const event = this.parseSetReadyPayload(payload);
    if (!event) {
      this.logger.warn("Ignoring setReady with invalid payload");
      return;
    }

    const lobbyId = this.normalizeId(event.lobbyId);
    const lobby = this.lobbies.get(lobbyId);
    const player = lobby?.players.find((p) => p.userId === event.userId);
    if (!lobby || !player) {
      this.logger.debug(
        `Ignoring setReady for non-queued player: user=${event.userId} lobby=${lobbyId}`
      );
      return;
    }

    player.ready = event.ready;
    this.logger.log(`Player ready=${event.ready}: user=${event.userId} lobby=${lobbyId}`);
    await this.evaluate(lobby);
  }

  getQueueSize(lobbyId: string) {
    return this.lobbies.get(this.normalizeId(lobbyId))?.players.length ?? 0;
  }

  /** Tras cualquier cambio: arranca si hay >= min y TODOS ready; si no, emite el estado. */
  private async evaluate(lobby: Lobby) {
    const enough = lobby.players.length >= envs.matchmakingMinPlayers;
    const allReady = lobby.players.length > 0 && lobby.players.every((p) => p.ready);
    if (enough && allReady) {
      await this.startMatch(lobby);
      return;
    }
    await this.emitLobbyState(lobby);
  }

  /** Saca a TODOS los jugadores (todos ready), asigna roles y emite match.found. */
  private async startMatch(lobby: Lobby) {
    const players = lobby.players.splice(0, lobby.players.length);

    const event: MatchFoundPayload = {
      lobbyId: lobby.lobbyId,
      gameId: randomUUID(),
      players: this.assignRoles(players)
    };

    try {
      await this.messaging.publish(MatchmakingSubjects.matchFound, event);
      this.logger.log(`Match found: game=${event.gameId} lobby=${lobby.lobbyId}`);
    } catch (error) {
      lobby.players.unshift(...players);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to publish match found: ${message}`);
      await this.emitLobbyState(lobby);
      return;
    }

    if (lobby.players.length === 0) {
      this.lobbies.delete(lobby.lobbyId);
    }
  }

  /** 1 seeker al azar, el resto hiders. */
  private assignRoles(players: QueuedPlayer[]): { userId: string; role: PlayerRole }[] {
    const seekerIndex = Math.floor(Math.random() * players.length);
    return players.map((player, index) => ({
      userId: player.userId,
      role: index === seekerIndex ? "seeker" : "hider"
    }));
  }

  private async emitLobbyState(lobby: Lobby) {
    const payload: LobbyStatePayload = {
      lobbyId: lobby.lobbyId,
      players: lobby.players.map((p) => ({
        userId: p.userId,
        username: p.username,
        ready: p.ready
      })),
      count: lobby.players.length,
      min: envs.matchmakingMinPlayers,
      max: envs.matchmakingMaxPlayers
    };

    try {
      await this.messaging.publish(MatchmakingSubjects.lobbyUpdated, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to publish lobby state: ${message}`);
    }
  }

  private getLobby(lobbyId: string) {
    const current = this.lobbies.get(lobbyId);
    if (current) return current;

    const lobby: Lobby = { lobbyId, players: [] };
    this.lobbies.set(lobbyId, lobby);
    return lobby;
  }

  private removePlayerFromAllLobbies(userId: string, socketId: string) {
    for (const [lobbyId] of this.lobbies) {
      this.removePlayerFromLobby(lobbyId, userId, socketId);
    }
  }

  private removePlayerFromLobby(lobbyId: string, userId: string, socketId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return false;

    const initialSize = lobby.players.length;

    for (let index = lobby.players.length - 1; index >= 0; index -= 1) {
      const player = lobby.players[index];
      if (player.userId === userId || player.socketId === socketId) {
        lobby.players.splice(index, 1);
      }
    }

    if (lobby.players.length === 0) {
      this.lobbies.delete(lobbyId);
    }

    return lobby.players.length !== initialSize;
  }

  private isJoinQueuePayload(payload: unknown): payload is MatchmakingJoinQueuePayload {
    return (
      this.isRecord(payload) &&
      this.isNonEmptyString(payload.lobbyId) &&
      this.isNonEmptyString(payload.userId) &&
      this.isNonEmptyString(payload.username) &&
      this.isNonEmptyString(payload.socketId)
    );
  }

  private isLeaveQueuePayload(payload: unknown): payload is MatchmakingLeaveQueuePayload {
    return (
      this.isRecord(payload) &&
      this.isNonEmptyString(payload.lobbyId) &&
      this.isNonEmptyString(payload.userId) &&
      this.isNonEmptyString(payload.socketId)
    );
  }

  private parseSetReadyPayload(payload: unknown): SetReadyEvent | null {
    if (
      !this.isRecord(payload) ||
      !this.isNonEmptyString(payload.lobbyId) ||
      !this.isNonEmptyString(payload.userId) ||
      typeof payload.ready !== "boolean"
    ) {
      return null;
    }

    return { lobbyId: payload.lobbyId, userId: payload.userId, ready: payload.ready };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  private normalizeId(value: string) {
    return value.trim();
  }
}
