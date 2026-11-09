import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { env } from "../config/env.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const r = Router();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

function bucketDir(bucket: string) {
  const dir = path.join(env.STORAGE_DIR, bucket);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function safeName(name: string) { return name.replace(/[^\w.\-]/g, "_"); }

r.post("/upload", requireAuth, upload.single("file"), asyncHandler(async (req: any, res) => {
  const bucket = String(req.query.bucket || req.body?.bucket || "documentos");
  const file = req.file;
  if (!file) throw new HttpError(400, "Falta archivo.");
  const dir = bucketDir(bucket);
  const ruta = `${Date.now()}-${safeName(file.originalname)}`;
  const full = path.join(dir, ruta);
  // prevent traversal
  if (!full.startsWith(dir)) throw new HttpError(400, "Ruta inválida.");
  fs.writeFileSync(full, file.buffer);
  res.json({ ruta, bucket, originalName: file.originalname, size: file.size, mimetype: file.mimetype });
}));

r.get("/download", requireAuth, asyncHandler(async (req: any, res) => {
  const bucket = String(req.query.bucket);
  const ruta = String(req.query.ruta);
  const dir = bucketDir(bucket);
  const full = path.join(dir, ruta);
  if (!full.startsWith(dir)) throw new HttpError(400, "Ruta inválida.");
  if (!fs.existsSync(full)) throw new HttpError(404, "Archivo no encontrado.");
  res.download(full);
}));

r.delete("/file", requireAuth, asyncHandler(async (req: any, res) => {
  const bucket = String(req.query.bucket);
  const ruta = String(req.query.ruta);
  const dir = bucketDir(bucket);
  const full = path.join(dir, ruta);
  if (!full.startsWith(dir)) throw new HttpError(400, "Ruta inválida.");
  if (fs.existsSync(full)) fs.unlinkSync(full);
  res.status(204).send();
}));

export default r;
