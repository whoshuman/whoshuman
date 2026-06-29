import "dotenv/config";
import * as joi from "joi";

interface EnvVars {
  NATS_SERVERS: string[];
  DATABASE_URL: string;
  GAME_TICK_MS: number;
  GAME_SPEED: number;
  GAME_MAP_SIZE: number;
}

const envSchema = joi
  .object<EnvVars>({
    NATS_SERVERS: joi.array().items(joi.string().uri()).min(1).required(),
    DATABASE_URL: joi
      .string()
      .uri({ scheme: [/postgresql/] })
      .required(),
    GAME_TICK_MS: joi.number().integer().min(1).default(50),
    GAME_SPEED: joi.number().positive().default(5),
    GAME_MAP_SIZE: joi.number().positive().default(50)
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
  gameTickMs: envVars.GAME_TICK_MS,
  gameSpeed: envVars.GAME_SPEED,
  gameMapSize: envVars.GAME_MAP_SIZE
};
