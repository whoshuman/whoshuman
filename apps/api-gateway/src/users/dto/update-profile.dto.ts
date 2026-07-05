import {
  SUPPORTED_LANGUAGES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH
} from "@whoshuman/shared-validation";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  username!: string;

  @IsIn(SUPPORTED_LANGUAGES)
  language!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
