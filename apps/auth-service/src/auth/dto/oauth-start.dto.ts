import type { OAuthProvider, OAuthStartPayload } from "@whoshuman/shared-types";
import { IsIn, IsString, MinLength } from "class-validator";

export class OAuthStartDto implements OAuthStartPayload {
  @IsIn(["google", "42"])
  provider!: OAuthProvider;

  @IsString()
  @MinLength(32)
  state!: string;
}
