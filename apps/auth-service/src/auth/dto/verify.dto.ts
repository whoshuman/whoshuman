import { IsString } from "class-validator";

/** Lleva un access token JWT para validarlo o extraer el perfil. */
export class VerifyDto {
  @IsString()
  token!: string;
}
