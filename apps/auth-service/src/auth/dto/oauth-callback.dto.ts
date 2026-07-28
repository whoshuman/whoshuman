import type { OAuthCallbackPayload, OAuthProvider } from "@whoshuman/shared-types";
import { IsIn, IsString, MinLength } from "class-validator";

export class OAuthCallbackDto implements OAuthCallbackPayload {
  @IsIn(["google", "42"])
  provider!: OAuthProvider;

  @IsString()
  @MinLength(1)
  code!: string;
}
