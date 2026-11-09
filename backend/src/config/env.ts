import "dotenv/config";

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/taller",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh",
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "7d",
  STORAGE_DIR: process.env.STORAGE_DIR ?? "/data/storage",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@taller.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "ChangeMe123!",
  FORCE_PASSWORD_CHANGE: (process.env.FORCE_PASSWORD_CHANGE ?? "true") === "true",
};
