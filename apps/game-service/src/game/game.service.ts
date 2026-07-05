import { Injectable, Logger } from "@nestjs/common";
import { GameSubjects } from "@whoshuman/shared-events";
import type { GameStateSnapshotPayload, MatchFoundPayload } from "@whoshuman/shared-types";
import { MessagingService } from "../common/messaging.service";
import { envs } from "../config";
import { GameSession } from "./game-session";
import { loadMap, type MapDescriptor } from "./map";

interface RunningGame {
  session: GameSession;
  timer: NodeJS.Timeout;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly games = new Map<string, RunningGame>();

  constructor(private readonly messaging: MessagingService) {}

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
      maxStep: envs.gameMaxStep
    });
    const dt = envs.gameTickMs / 1000;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      session.tick(dt);
      void this.broadcast(payload.gameId, tick, session);
    }, envs.gameTickMs);

    this.games.set(payload.gameId, { session, timer });
    this.logger.log(`Game started: game=${payload.gameId} players=${payload.players.length}`);
  }

  join(payload: unknown): void {
    if (!this.isPlayerRef(payload)) return;
    this.games.get(payload.gameId)?.session.markPresent(payload.userId);
  }

  input(payload: unknown): void {
    if (!this.isInputRef(payload)) return;
    this.games.get(payload.gameId)?.session.setInput(payload.userId, payload.forward, payload.turn);
  }

  leave(payload: unknown): void {
    if (!this.isPlayerRef(payload)) return;
    const running = this.games.get(payload.gameId);
    if (!running) return;
    running.session.removePlayer(payload.userId);
    if (running.session.isEmpty) {
      clearInterval(running.timer);
      this.games.delete(payload.gameId);
      this.logger.log(`Game ended (empty): game=${payload.gameId}`);
    }
  }

  getGameCount(): number {
    return this.games.size;
  }

  private async broadcast(gameId: string, tick: number, session: GameSession): Promise<void> {
    const event: GameStateSnapshotPayload = { gameId, tick, players: session.snapshot() };
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

  private isInputRef(
    p: unknown
  ): p is { userId: string; gameId: string; forward: number; turn: number } {
    if (!this.isPlayerRef(p)) return false;
    const r = p as { forward?: unknown; turn?: unknown };
    return typeof r.forward === "number" && typeof r.turn === "number";
  }
}
