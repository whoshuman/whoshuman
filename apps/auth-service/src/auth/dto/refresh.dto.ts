import { IsString } from "class-validator";

/**
 * Lleva el refresh token. Se reutiliza tanto para renovar la sesión (refresh)
 * como para cerrarla (logout), ya que ambos operan sobre el mismo token.
 */
export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
