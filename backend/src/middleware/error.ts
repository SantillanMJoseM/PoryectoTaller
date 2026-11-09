import type { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.code === "P2002") return res.status(409).json({ error: "Registro duplicado." });
  if (err?.code === "P2025") return res.status(404).json({ error: "Registro no encontrado." });
  console.error(err);
  return res.status(500).json({ error: err?.message ?? "Error interno del servidor." });
}
