import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

/**
 * Valida el body del POST /auth/register en el gateway.
 *
 * Cada decorador lleva un `message` con una clave de traducción (validation.*),
 * así el error de validación (400) sale traducido al idioma de la petición.
 */
export class RegisterDto {
  @IsEmail({}, { message: i18nValidationMessage("validation.isEmail") })
  email!: string;

  @IsString({ message: i18nValidationMessage("validation.isString") })
  @MinLength(3, { message: i18nValidationMessage("validation.minLength") })
  @MaxLength(20, { message: i18nValidationMessage("validation.maxLength") })
  username!: string;

  @IsString({ message: i18nValidationMessage("validation.isString") })
  @MinLength(8, { message: i18nValidationMessage("validation.minLength") })
  password!: string;
}
