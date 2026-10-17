import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_TTL_DAYS: Joi.number().integer().min(1).default(7),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  THROTTLE_TTL: Joi.number().default(60_000),
  THROTTLE_LIMIT: Joi.number().default(120),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  SEED_ON_EMPTY: Joi.boolean().truthy('true').falsy('false').default(true),
  SETTINGS_ENCRYPTION_KEY: Joi.string().min(16).required(),
  OLLAMA_BASE_URL: Joi.string().uri().default('http://127.0.0.1:11434'),
});

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_TTL_DAYS: number;
  CORS_ORIGIN: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  LOG_LEVEL: string;
  SEED_ON_EMPTY: boolean;
  SETTINGS_ENCRYPTION_KEY: string;
  OLLAMA_BASE_URL: string;
}
