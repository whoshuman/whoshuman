import type { VerifyPayload } from "@whoshuman/shared-types";
import { IsString } from "class-validator";

/** Lleva un access token JWT para validarlo o extraer el perfil. */
export class VerifyDto implements VerifyPayload {
  @IsString()
  token!: string;
}
