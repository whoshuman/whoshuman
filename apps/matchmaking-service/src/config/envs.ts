import "dotenv/config";
import * as joi from "joi";

interface EnvVars {
  NATS_SERVERS: string[];
  MATCHMAKING_MIN_PLAYERS: number;
  MATCHMAKING_MAX_PLAYERS: number;
}

const envSchema = joi
  .object<EnvVars>({
    NATS_SERVERS: joi.array().items(joi.string().uri()).min(1).required(),
    MATCHMAKING_MIN_PLAYERS: joi.number().integer().min(2).default(2),
    MATCHMAKING_MAX_PLAYERS: joi
      .number()
      .integer()
      .min(joi.ref("MATCHMAKING_MIN_PLAYERS"))
      .default(8)
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
  matchmakingMinPlayers: envVars.MATCHMAKING_MIN_PLAYERS,
  matchmakingMaxPlayers: envVars.MATCHMAKING_MAX_PLAYERS
};
