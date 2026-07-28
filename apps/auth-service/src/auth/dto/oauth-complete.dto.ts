import type { OAuthCompletePayload } from "@whoshuman/shared-types";
import { SUPPORTED_LANGUAGES } from "@whoshuman/shared-validation";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class OAuthCompleteDto implements OAuthCompletePayload {
  @IsString()
  @MinLength(1)
  ticket!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: string;
}
