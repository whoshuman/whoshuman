import { Controller } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { GameSubjects, MatchmakingSubjects } from "@whoshuman/shared-events";
import { GameService } from "./game.service";

@Controller()
export class GameController {
  constructor(private readonly game: GameService) {}

  // El game-service también escucha match.found (otro queue group que el gateway).
  @EventPattern(MatchmakingSubjects.matchFound)
  handleMatchFound(@Payload() payload: unknown) {
    this.game.startGame(payload);
  }

  @EventPattern(GameSubjects.join)
  handleJoin(@Payload() payload: unknown) {
    this.game.join(payload);
  }

  @EventPattern(GameSubjects.playerMoved)
  handleInput(@Payload() payload: unknown) {
    this.game.input(payload);
  }

  @EventPattern(GameSubjects.leave)
  handleLeave(@Payload() payload: unknown) {
    this.game.leave(payload);
  }
}
