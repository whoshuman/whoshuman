import type { RefreshPayload } from "@whoshuman/shared-types";
import { IsString } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

/**
 * Valida el body de POST /auth/refresh y POST /auth/logout.
 * Ambos operan sobre el refresh token, así que comparten DTO.
 */
export class RefreshDto implements RefreshPayload {
  @IsString({ message: i18nValidationMessage("validation.isString") })
  refreshToken!: string;
}
