import type { RegisterPayload } from "@whoshuman/shared-types";
import { SUPPORTED_LANGUAGES } from "@whoshuman/shared-validation";
import { IsEmail, IsString, MinLength, MaxLength, IsIn, IsOptional } from "class-validator";

/**
 * Datos necesarios para registrar un usuario nuevo.
 * class-validator comprueba cada regla antes de que el handler reciba el objeto.
 */
export class RegisterDto implements Omit<RegisterPayload, "language"> {
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

  // Opcional en la entrada (el cliente puede no mandarlo): AuthService.register()
  // aplica DEFAULT_LANGUAGE como fallback si falta o no está soportado. Por eso el
  // DTO implementa RegisterPayload salvo `language` (ese campo sí es obligatorio
  // en el contrato compartido, pero aquí es opcional a nivel de entrada/validación).
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: string;
}
