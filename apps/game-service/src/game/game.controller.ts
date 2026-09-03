import { Controller } from "@nestjs/common";
import { EventPattern, MessagePattern, Payload } from "@nestjs/microservices";
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

  @MessagePattern(GameSubjects.join)
  handleJoin(@Payload() payload: unknown) {
    return this.game.join(payload);
  }

  @EventPattern(GameSubjects.playerMoved)
  handleInput(@Payload() payload: unknown) {
    this.game.input(payload);
  }

  @EventPattern(GameSubjects.shoot)
  handleShoot(@Payload() payload: unknown) {
    this.game.shoot(payload);
  }

  @EventPattern(GameSubjects.switchRole)
  handleSwitchRole(@Payload() payload: unknown) {
    this.game.switchRole(payload);
  }

  @EventPattern(GameSubjects.aim)
  handleAim(@Payload() payload: unknown) {
    this.game.aim(payload);
  }

  @EventPattern(GameSubjects.leave)
  handleLeave(@Payload() payload: unknown) {
    this.game.leave(payload);
  }

  @EventPattern(GameSubjects.disconnected)
  handleDisconnect(@Payload() payload: unknown) {
    this.game.disconnect(payload);
  }
}
