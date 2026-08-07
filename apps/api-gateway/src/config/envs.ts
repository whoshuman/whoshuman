import "dotenv/config";
import * as joi from "joi";

interface EnvVars {
  PORT: number;
  NATS_SERVERS: string[];
  RATE_LIMIT_TTL_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  JWT_SECRET?: string;
  FRONTEND_URL: string;
  OAUTH_COOKIE_SECURE: boolean;
}

const envSchema = joi
  .object<EnvVars>({
    PORT: joi.number().integer().positive().default(3000),
    NATS_SERVERS: joi.array().items(joi.string().uri()).min(1).required(),
    RATE_LIMIT_TTL_MS: joi.number().integer().positive().default(60000),
    RATE_LIMIT_MAX_REQUESTS: joi.number().integer().positive().default(100),
    JWT_SECRET: joi.string().allow("").optional(),
    FRONTEND_URL: joi.string().uri().default("https://localhost"),
    OAUTH_COOKIE_SECURE: joi.boolean().truthy("true").falsy("false").default(true)
  })
  .unknown(true);

const validationResult: joi.ValidationResult<EnvVars> = envSchema.validate({
  ...process.env,
  PORT: process.env["PORT"] ? Number(process.env["PORT"]) : undefined,
  RATE_LIMIT_TTL_MS: process.env["RATE_LIMIT_TTL_MS"]
    ? Number(process.env["RATE_LIMIT_TTL_MS"])
    : undefined,
  RATE_LIMIT_MAX_REQUESTS: process.env["RATE_LIMIT_MAX_REQUESTS"]
    ? Number(process.env["RATE_LIMIT_MAX_REQUESTS"])
    : undefined,
  NATS_SERVERS: process.env["NATS_SERVERS"]?.split(",").map((item) => item.trim())
});

const { error } = validationResult;

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars = validationResult.value;

export const envs = {
  port: envVars.PORT,
  natsServers: envVars.NATS_SERVERS,
  rateLimitTtlMs: envVars.RATE_LIMIT_TTL_MS,
  rateLimitMaxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  jwtSecret: envVars.JWT_SECRET || undefined,
  frontendUrl: envVars.FRONTEND_URL,
  oauthCookieSecure: envVars.OAUTH_COOKIE_SECURE
};
