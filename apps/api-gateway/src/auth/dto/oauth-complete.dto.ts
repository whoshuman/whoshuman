import type { OAuthCompletePayload } from "@whoshuman/shared-types";
import { SUPPORTED_LANGUAGES } from "@whoshuman/shared-validation";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class OAuthCompleteDto implements OAuthCompletePayload {
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @MinLength(1, { message: i18nValidationMessage("validation.minLength") })
  ticket!: string;

  @IsOptional()
  @IsString({ message: i18nValidationMessage("validation.isString") })
  @MinLength(3, { message: i18nValidationMessage("validation.minLength") })
  @MaxLength(20, { message: i18nValidationMessage("validation.maxLength") })
  username?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: string;
}
