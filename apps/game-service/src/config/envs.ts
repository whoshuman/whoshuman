import "dotenv/config";
import * as joi from "joi";

interface EnvVars {
  NATS_SERVERS: string[];
  DATABASE_URL: string;
  GAME_TICK_MS: number;
  GAME_TURN_SPEED: number;
  GAME_MAX_SLOPE: number;
  GAME_MAP: string;
  GAME_NPC_COUNT: number;
  GAME_NPC_SPEED: number;
}

const envSchema = joi
  .object<EnvVars>({
    NATS_SERVERS: joi.array().items(joi.string().uri()).min(1).required(),
    DATABASE_URL: joi
      .string()
      .uri({ scheme: [/postgresql/] })
      .required(),
    GAME_TICK_MS: joi.number().integer().min(1).default(50),
    // Ya no hay GAME_SPEED: la velocidad del jugador era 8x la de los NPC y bastaba
    // para señalarlo entre la multitud. Ahora todos usan GAME_NPC_SPEED.
    GAME_TURN_SPEED: joi.number().positive().default(3.0),
    // Pendiente máxima que se puede SUBIR (altura/distancia), no desnivel por paso:
    // aquello dependía de la velocidad y, con la multitud andando despacio, dejaba
    // escalar paredes a pasitos. En beta-city las paredes arrancan en 1.72, así que
    // 1.5 las bloquea; apretarlo más forma bolsas donde la gente se queda atascada
    // (medido: a 0.7, hasta 14 s parados; a 1.5, 2.4 s, el roce normal del gentío).
    GAME_MAX_SLOPE: joi.number().positive().default(1.5),
    GAME_MAP: joi.string().default("neon-block"),
    GAME_NPC_COUNT: joi.number().integer().min(0).max(64).default(32),
    // Velocidad de toda la multitud, humanos incluidos. 0.36 = la zancada del clip
    // "sprint" (0.18 u de mundo por ciclo, medida sobre el pie de apoyo) entre la
    // duración con la que se animó (1.067 s), o sea: andar a su ritmo natural.
    GAME_NPC_SPEED: joi.number().positive().max(3).default(0.36)
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
  gameTurnSpeed: envVars.GAME_TURN_SPEED,
  gameMaxSlope: envVars.GAME_MAX_SLOPE,
  gameMap: envVars.GAME_MAP,
  gameNpcCount: envVars.GAME_NPC_COUNT,
  gameNpcSpeed: envVars.GAME_NPC_SPEED
};
