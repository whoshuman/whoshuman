import type { LoginPayload } from "@whoshuman/shared-types";
import { IsEmail, IsString } from "class-validator";

/** Credenciales para iniciar sesión. */
export class LoginDto implements LoginPayload {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
