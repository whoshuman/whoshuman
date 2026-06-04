import type { RegisterPayload } from "@whoshuman/shared-types";
import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";

/**
 * Datos necesarios para registrar un usuario nuevo.
 * class-validator comprueba cada regla antes de que el handler reciba el objeto.
 */
export class RegisterDto implements RegisterPayload {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username!: string;

  // Mínimo 8 caracteres por seguridad — se hashea con bcrypt antes de guardarse.
  @IsString()
  @MinLength(8)
  password!: string;
}
