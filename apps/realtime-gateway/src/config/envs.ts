import "dotenv/config";
import * as joi from "joi";

interface EnvVars {
  PORT: number;
  NATS_SERVERS: string[];
  CORS_ORIGINS: string[];
  CORS_CREDENTIALS: boolean;
  JWT_SECRET?: string;
}

const envSchema = joi
  .object<EnvVars>({
    PORT: joi.number().integer().positive().default(3000),
    NATS_SERVERS: joi.array().items(joi.string().uri()).min(1).required(),
    CORS_ORIGINS: joi
      .array()
      .items(joi.string().uri({ scheme: [/https?/] }))
      .min(1)
      .default(["https://localhost", "http://localhost"]),
    CORS_CREDENTIALS: joi.boolean().default(false),
    JWT_SECRET: joi.string().allow("").optional()
  })
  .unknown(true);

const validationResult: joi.ValidationResult<EnvVars> = envSchema.validate({
  ...process.env,
  PORT: process.env["PORT"] ? Number(process.env["PORT"]) : undefined,
  NATS_SERVERS: process.env["NATS_SERVERS"]?.split(",").map((item) => item.trim()),
  CORS_ORIGINS: process.env["CORS_ORIGINS"]?.split(",").map((item) => item.trim())
});

const { error } = validationResult;

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars = validationResult.value;

export const envs = {
  port: envVars.PORT,
  natsServers: envVars.NATS_SERVERS,
  corsOrigins: envVars.CORS_ORIGINS,
  corsCredentials: envVars.CORS_CREDENTIALS,
  jwtSecret: envVars.JWT_SECRET || undefined
};
