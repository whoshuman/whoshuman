import "dotenv/config";
import * as joi from "joi";

interface EnvVars {
  NATS_SERVERS: string[];
  DATABASE_URL: string;
  GAME_TICK_MS: number;
  GAME_SPEED: number;
  GAME_TURN_SPEED: number;
  GAME_MAX_STEP: number;
  GAME_MAP: string;
}

const envSchema = joi
  .object<EnvVars>({
    NATS_SERVERS: joi.array().items(joi.string().uri()).min(1).required(),
    DATABASE_URL: joi
      .string()
      .uri({ scheme: [/postgresql/] })
      .required(),
    GAME_TICK_MS: joi.number().integer().min(1).default(50),
    GAME_SPEED: joi.number().positive().default(3),
    GAME_TURN_SPEED: joi.number().positive().default(3.0),
    GAME_MAX_STEP: joi.number().positive().default(0.11),
    GAME_MAP: joi.string().default("beta-city")
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
  gameTurnSpeed: envVars.GAME_TURN_SPEED,
  gameMaxStep: envVars.GAME_MAX_STEP,
  gameMap: envVars.GAME_MAP
};
