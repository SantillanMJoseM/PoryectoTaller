import type { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../lib/jwt.js";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    tipo: "administrador" | "cliente";
    correo: string;
    permisos: string[];
    sessionId?: string;
  };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado." });
  try {
    const p = verifyAccess(token);
    req.user = { id: p.sub, tipo: p.tipo, correo: p.correo, permisos: p.permisos ?? [], sessionId: p.sessionId };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.tipo !== "administrador") return res.status(403).json({ error: "Solo administradores." });
  next();
}

export function requirePermission(...codes: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const perms = req.user?.permisos ?? [];
    const ok = codes.length === 0 || codes.some((c) => perms.includes(c));
    if (!ok) return res.status(403).json({ error: "Sin permiso para esta operación." });
    next();
  };
}
