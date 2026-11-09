import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessPayload {
  sub: string; // usuario id or cliente id
  tipo: "administrador" | "cliente";
  correo: string;
  permisos: string[];
  sessionId?: string;
}

export function signAccess(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL } as jwt.SignOptions);
}

export function signRefresh(payload: { sub: string; tipo: string; jti: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL } as jwt.SignOptions);
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

export function verifyRefresh(token: string): { sub: string; tipo: string; jti: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; tipo: string; jti: string };
}
