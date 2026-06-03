import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { AuthSubjects } from "@whoshuman/shared-events";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { VerifyDto } from "./dto/verify.dto";

/**
 * AuthController es la "puerta de entrada" del servicio por NATS.
 *
 * No tiene rutas HTTP: cada método escucha un "subject" de NATS (auth.register,
 * auth.login, etc.). El api-gateway publica mensajes en esos subjects y este
 * controlador los recibe. La validación de los DTOs ocurre automáticamente gracias
 * al ValidationPipe global configurado en main.ts.
 *
 * El controlador solo delega: toda la lógica vive en AuthService.
 */
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AuthSubjects.register)
  register(@Payload() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @MessagePattern(AuthSubjects.login)
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern(AuthSubjects.logout)
  logout(@Payload() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @MessagePattern(AuthSubjects.refresh)
  refresh(@Payload() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @MessagePattern(AuthSubjects.verify)
  verify(@Payload() dto: VerifyDto) {
    return this.authService.verify(dto.token);
  }
}
