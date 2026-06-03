import "dotenv/config";
import * as joi from "joi";
import ms from "ms";

interface EnvVars {
  NATS_SERVERS: string[];
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: ms.StringValue;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: ms.StringValue;
}

const durationSchema = joi.string().custom((value: string, helpers) => {
  const durationMs = ms(value as ms.StringValue) as number | undefined;

  if (durationMs === undefined) {
    return helpers.error("any.invalid");
  }

  return value;
});

const envSchema = joi
  .object<EnvVars>({
    NATS_SERVERS: joi.array().items(joi.string().uri()).min(1).required(),
    DATABASE_URL: joi
      .string()
      .uri({ scheme: [/postgresql/] })
      .required(),
    JWT_SECRET: joi.string().min(1).required(),
    JWT_EXPIRES_IN: durationSchema.default("15m"),
    JWT_REFRESH_SECRET: joi.string().min(1).required(),
    JWT_REFRESH_EXPIRES_IN: durationSchema.default("7d")
  })
  .unknown(true);

const validationResult: joi.ValidationResult<EnvVars> = envSchema.validate({
  ...process.env,
  NATS_SERVERS: process.env["NATS_SERVERS"]?.split(",").map((item) => item.trim())
});

const { error } = validationResult;

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars = validationResult.value;

export const envs = {
  natsServers: envVars.NATS_SERVERS,
  databaseUrl: envVars.DATABASE_URL,
  jwtSecret: envVars.JWT_SECRET,
  jwtExpiresIn: envVars.JWT_EXPIRES_IN,
  jwtRefreshSecret: envVars.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN
};
