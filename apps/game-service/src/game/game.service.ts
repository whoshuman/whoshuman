import { Injectable, Logger } from "@nestjs/common";
import { GameSubjects } from "@whoshuman/shared-events";
import type {
  GameJoinResponse,
  GameScoreState,
  GameStateSnapshotPayload,
  MatchFoundPayload
} from "@whoshuman/shared-types";
import { MessagingService } from "../common/messaging.service";
import { envs } from "../config";
import { PrismaService } from "../prisma/prisma.service";
import { GAME_RULES, GameSession } from "./game-session";
import { loadMap, type MapDescriptor } from "./map";

interface RunningGame {
  session: GameSession;
  timer: NodeJS.Timeout;
  reconnectTimers: Map<string, NodeJS.Timeout>;
  activeSockets: Map<string, string>;
  departedScores: Map<string, GameScoreState>;
  finishing: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const RECONNECT_GRACE_MS = 45_000;

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly games = new Map<string, RunningGame>();

  constructor(
    private readonly messaging: MessagingService,
    private readonly prisma: PrismaService
  ) {}

  /** match.found → crea la partida y arranca su loop. */
  startGame(payload: unknown): void {
    if (!this.isMatchFound(payload)) {
      this.logger.warn("Ignoring match.found with invalid payload");
      return;
    }
    if (this.games.has(payload.gameId)) return; // idempotente

    let map: MapDescriptor;
    try {
      map = loadMap(envs.gameMap);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cannot load map "${envs.gameMap}": ${message}`);
      return; // mapa mal configurado → no arranca la partida
    }

    const session = new GameSession(payload.gameId, payload.players, {
      bounds: map.bounds,
      speed: envs.gameSpeed,
      turnSpeed: envs.gameTurnSpeed,
      obstacles: map.obstacles,
      heightmap: map.heightmap,
      maxStep: envs.gameMaxStep,
      npcCount: envs.gameNpcCount,
      npcSpeed: envs.gameNpcSpeed
    });
    const dt = envs.gameTickMs / 1000;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      session.tick(dt);
      const running = this.games.get(payload.gameId);
      if (!running) return;
      if (session.roundSnapshot().phase === "finished") {
        clearInterval(timer);
        void this.finishGame(payload.gameId, tick, running);
        return;
      }
      void this.broadcast(payload.gameId, tick, session);
    }, envs.gameTickMs);

    this.games.set(payload.gameId, {
      session,
      timer,
      reconnectTimers: new Map(),
      activeSockets: new Map(),
      departedScores: new Map(),
      finishing: false
    });
    this.logger.log(
      `Game started: game=${payload.gameId} players=${payload.players.length} npcs=${envs.gameNpcCount}`
    );
  }

  join(payload: unknown): GameJoinResponse | null {
    if (!this.isPlayerRef(payload)) return null;
    const running = this.games.get(payload.gameId);
    const player = running?.session.markPresent(payload.userId);
    const socketId = this.socketId(payload);
    if (player && socketId) {
      running?.activeSockets.set(payload.userId, socketId);
    }
    const reconnectTimer = running?.reconnectTimers.get(payload.userId);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      running?.reconnectTimers.delete(payload.userId);
    }
    return player
      ? {
          gameId: payload.gameId,
          selfUserId: payload.userId,
          selfEntityId: player.entityId,
          role: player.role
        }
      : null;
  }

  input(payload: unknown): void {
    if (!this.isInputRef(payload)) return;
    this.games.get(payload.gameId)?.session.setInput(payload.userId, payload.forward, payload.turn);
  }

  aim(payload: unknown): boolean {
    if (!this.isAimRef(payload)) return false;
    return (
      this.games.get(payload.gameId)?.session.setAiming(payload.userId, payload.aiming) ?? false
    );
  }

  shoot(payload: unknown): boolean {
    if (!this.isShootRef(payload)) return false;
    return (
      this.games.get(payload.gameId)?.session.shoot(payload.userId, payload.targetEntityId) ?? false
    );
  }

  leave(payload: unknown): void {
    if (!this.isPlayerRef(payload)) return;
    this.removePlayer(payload.gameId, payload.userId);
  }

  disconnect(payload: unknown): void {
    if (!this.isPlayerRef(payload)) return;
    const running = this.games.get(payload.gameId);
    const socketId = this.socketId(payload);
    if (socketId && running?.activeSockets.get(payload.userId) !== socketId) {
      return;
    }
    if (!running?.session.markDisconnected(payload.userId)) return;
    running.activeSockets.delete(payload.userId);

    const previousTimer = running.reconnectTimers.get(payload.userId);
    if (previousTimer) clearTimeout(previousTimer);
    const timer = setTimeout(() => {
      running.reconnectTimers.delete(payload.userId);
      this.removePlayer(payload.gameId, payload.userId);
    }, RECONNECT_GRACE_MS);
    running.reconnectTimers.set(payload.userId, timer);
  }

  private removePlayer(gameId: string, userId: string): void {
    const running = this.games.get(gameId);
    if (!running) return;
    const reconnectTimer = running.reconnectTimers.get(userId);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    running.reconnectTimers.delete(userId);
    running.activeSockets.delete(userId);
    const departed = running.session.removePlayer(userId);
    if (departed) running.departedScores.set(userId, departed);
    if (running.session.isEmpty) {
      clearInterval(running.timer);
      for (const pending of running.reconnectTimers.values()) clearTimeout(pending);
      this.games.delete(gameId);
      this.logger.log(`Game ended (empty): game=${gameId}`);
    }
  }

  getGameCount(): number {
    return this.games.size;
  }

  private async finishGame(gameId: string, tick: number, running: RunningGame): Promise<void> {
    if (running.finishing) return;
    running.finishing = true;

    const scoreMap = new Map(running.departedScores);
    for (const score of running.session.scoreSnapshot()) scoreMap.set(score.userId, score);
    const scores = [...scoreMap.values()];

    try {
      await this.prisma.$transaction([
        this.prisma.game.upsert({
          where: { id: gameId },
          create: { id: gameId, status: "ENDED" },
          update: { status: "ENDED" }
        }),
        this.prisma.round.deleteMany({ where: { gameId } }),
        this.prisma.round.createMany({
          data: running.session.roundRecords().map((round) => ({
            gameId,
            number: round.number,
            status: "ENDED",
            timeLimit: GAME_RULES.roundSeconds,
            startedAt: round.startedAt,
            endedAt: round.endedAt
          }))
        }),
        ...scores.map((score) =>
          this.prisma.score.upsert({
            where: { userId_gameId: { userId: score.userId, gameId } },
            create: { userId: score.userId, gameId, points: score.score },
            update: { points: score.score }
          })
        )
      ]);
      this.logger.log(`Game result saved: game=${gameId} players=${scores.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save game result: game=${gameId} error=${message}`);
    }

    // El cliente solo ve `finished` cuando el resultado ya está disponible para
    // el perfil. Así evitamos que consulte estadísticas antiguas al salir rápido.
    await this.broadcast(gameId, tick, running.session);
    for (const timer of running.reconnectTimers.values()) clearTimeout(timer);
    if (this.games.get(gameId) === running) this.games.delete(gameId);
  }

  private async broadcast(gameId: string, tick: number, session: GameSession): Promise<void> {
    const event: GameStateSnapshotPayload = {
      gameId,
      tick,
      entities: session.snapshot(),
      collectibles: session.collectibleSnapshot(),
      round: session.roundSnapshot(),
      scores: session.scoreSnapshot()
    };
    try {
      await this.messaging.publish(GameSubjects.stateSnapshot, event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to publish game state: ${message}`);
    }
  }

  private isMatchFound(p: unknown): p is MatchFoundPayload {
    return isRecord(p) && typeof p.gameId === "string" && Array.isArray(p.players);
  }

  private isPlayerRef(p: unknown): p is { userId: string; gameId: string } {
    return isRecord(p) && typeof p.userId === "string" && typeof p.gameId === "string";
  }

  private socketId(p: unknown): string | null {
    return isRecord(p) && typeof p.socketId === "string" ? p.socketId : null;
  }

  private isInputRef(
    p: unknown
  ): p is { userId: string; gameId: string; forward: number; turn: number } {
    if (!this.isPlayerRef(p)) return false;
    const r = p as { forward?: unknown; turn?: unknown };
    return typeof r.forward === "number" && typeof r.turn === "number";
  }

  private isShootRef(p: unknown): p is { userId: string; gameId: string; targetEntityId: string } {
    if (!this.isPlayerRef(p)) return false;
    const targetEntityId = (p as { targetEntityId?: unknown }).targetEntityId;
    return typeof targetEntityId === "string" && targetEntityId.trim().length > 0;
  }

  private isAimRef(p: unknown): p is { userId: string; gameId: string; aiming: boolean } {
    return this.isPlayerRef(p) && typeof (p as { aiming?: unknown }).aiming === "boolean";
  }
}
