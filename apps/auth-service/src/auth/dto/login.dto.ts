import { IsEmail, IsString } from "class-validator";

/** Credenciales para iniciar sesión. */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
