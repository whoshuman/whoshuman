import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { MatchmakingSubjects } from "@whoshuman/shared-events";
import type {
  LobbyStatePayload,
  LobbyStatus,
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
}

interface Lobby {
  lobbyId: string;
  players: QueuedPlayer[];
  status: LobbyStatus;
  startsAt: number | null;
  countdownTimer: NodeJS.Timeout | null;
}

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
      socketId: payload.socketId
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

  getQueueSize(lobbyId: string) {
    return this.lobbies.get(this.normalizeId(lobbyId))?.players.length ?? 0;
  }

  /**
   * Decide qué hacer tras un cambio de jugadores y avisa a la sala.
   *   - lleno (>= max) → arranca ya.
   *   - alcanza el mínimo en "waiting" → empieza el countdown.
   *   - baja del mínimo en "starting" → cancela el countdown.
   * Siempre emite `lobby.updated` para que el frontend vea la sala en vivo.
   */
  private async evaluate(lobby: Lobby) {
    if (lobby.players.length >= envs.matchmakingMaxPlayers) {
      this.cancelCountdown(lobby);
      await this.startMatch(lobby);
      return;
    }

    if (lobby.players.length >= envs.matchmakingMinPlayers && lobby.status === "waiting") {
      this.beginCountdown(lobby);
    } else if (lobby.players.length < envs.matchmakingMinPlayers && lobby.status === "starting") {
      this.cancelCountdown(lobby);
    }

    await this.emitLobbyState(lobby);
  }

  private beginCountdown(lobby: Lobby) {
    lobby.status = "starting";
    lobby.startsAt = Date.now() + envs.matchmakingCountdownMs;
    lobby.countdownTimer = setTimeout(() => {
      void this.onCountdownExpire(lobby.lobbyId);
    }, envs.matchmakingCountdownMs);
    this.logger.log(`Countdown started: lobby=${lobby.lobbyId} startsAt=${lobby.startsAt}`);
  }

  private cancelCountdown(lobby: Lobby) {
    if (lobby.countdownTimer) clearTimeout(lobby.countdownTimer);
    lobby.countdownTimer = null;
    lobby.startsAt = null;
    lobby.status = "waiting";
  }

  private async onCountdownExpire(lobbyId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.players.length < envs.matchmakingMinPlayers) return;
    await this.startMatch(lobby);
  }

  /** Saca min..max jugadores, les asigna roles y emite match.found. */
  private async startMatch(lobby: Lobby) {
    const take = Math.min(lobby.players.length, envs.matchmakingMaxPlayers);
    const players = lobby.players.splice(0, take);

    const event: MatchFoundPayload = {
      lobbyId: lobby.lobbyId,
      gameId: randomUUID(),
      players: this.assignRoles(players)
    };

    try {
      await this.messaging.publish(MatchmakingSubjects.matchFound, event);
      this.logger.log(`Match found: game=${event.gameId} lobby=${lobby.lobbyId}`);
    } catch (error) {
      lobby.players.unshift(...players); // devolver a la sala si NATS falla
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to publish match found: ${message}`);
      await this.emitLobbyState(lobby);
      return;
    }

    this.cancelCountdown(lobby);
    if (lobby.players.length === 0) {
      this.lobbies.delete(lobby.lobbyId);
      return;
    }
    await this.evaluate(lobby); // por si quedan suficientes para otra partida
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
      players: lobby.players.map((p) => ({ userId: p.userId, username: p.username })),
      count: lobby.players.length,
      min: envs.matchmakingMinPlayers,
      max: envs.matchmakingMaxPlayers,
      status: lobby.status,
      startsAt: lobby.startsAt
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

    const lobby: Lobby = {
      lobbyId,
      players: [],
      status: "waiting",
      startsAt: null,
      countdownTimer: null
    };
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
      this.cancelCountdown(lobby);
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
