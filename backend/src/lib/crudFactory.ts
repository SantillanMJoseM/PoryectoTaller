import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { prisma } from "./prisma.js";
import { HttpError } from "../middleware/error.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export interface CrudConfig {
  model: string;          // prisma model name (camelCase)
  pk: string;             // primary key field
  searchFields?: string[];
  defaultSelect?: any;
  permisos: { view: string; add: string; edit: string; del: string };
  // portal access: function returning extra where for cliente role
  portalFilter?: (userId: string) => any;
  guardUpdate?: (id: string, data: any) => Promise<void>;
  guardDelete?: (id: string) => Promise<void>;
  sortableFields?: string[];
  relations?: Record<string, { relation: string; pk: string }>;
}

function model() { return prisma as any; }

export function buildCrudRouter(cfg: CrudConfig, authMw: any, permMw: (c: string) => any): Router {
  const r = createRouter();
  const M = () => (prisma as any)[cfg.model];

  // LIST
  const V = cfg.permisos.view ? permMw(cfg.permisos.view) : (_r:any,_s:any,n:any)=>n();
  const A = cfg.permisos.add ? permMw(cfg.permisos.add) : (_r:any,_s:any,n:any)=>n();
  const E = cfg.permisos.edit ? permMw(cfg.permisos.edit) : (_r:any,_s:any,n:any)=>n();
  const D = cfg.permisos.del ? permMw(cfg.permisos.del) : (_r:any,_s:any,n:any)=>n();
  r.get("/", authMw, V, asyncHandler(async (req: Request, res: Response) => {
      const page = Math.max(1, Number(req.query.pagina ?? 1));
      const size = Math.min(Math.max(1, Number(req.query.tamPagina ?? 20)), 200);
      const skip = (page - 1) * size;
      const q = (req.query.q as string)?.trim();
      const where: any = {};
      if (q && cfg.searchFields?.length) {
        where.OR = cfg.searchFields.map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
      }
      // filters
      for (const [k, v] of Object.entries(req.query)) {
        if (["pagina", "tamPagina", "q", "columna", "ascendente"].includes(k)) continue;
        if (v === undefined || v === null || v === "") continue;
        let val: any = v;
        if (val === "true") val = true;
        if (val === "false") val = false;
        where[k] = val;
      }
      const orderBy: any = {};
      if (req.query.columna) {
        const snake = String(req.query.columna);
        const camel = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (cfg.sortableFields && cfg.sortableFields.length > 0) {
          if (!cfg.sortableFields.includes(camel)) {
            throw new HttpError(400, `Columna de ordenamiento no válida: ${snake}`);
          }
        }
        orderBy[camel] = (req.query.ascendente === "true") ? "asc" : "desc";
      }
      const [data, total] = await Promise.all([
        M().findMany({ where, skip, take: size, orderBy: Object.keys(orderBy).length ? orderBy : undefined }),
        M().count({ where }),
      ]);
      res.json({ datos: data, total, pagina: page, tamPagina: size, paginas: Math.max(1, Math.ceil(total / size)) });
}));

  r.get("/count", authMw, V, asyncHandler(async (req: Request, res: Response) => {
    const where: any = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (v === undefined || v === null || v === "") continue;
      where[k] = v;
    }
    const c = await M().count({ where });
    res.json({ count: c });
}));

  r.get("/:id", authMw, V, asyncHandler(async (req: Request, res: Response) => {
    const item = await M().findUnique({ where: { [cfg.pk]: req.params.id } });
    if (!item) throw new HttpError(404, "No encontrado.");
    res.json(item);
}));

  r.post("/", authMw, A, asyncHandler(async (req: Request, res: Response) => {
    const data = transformRelations(cfg, req.body);
    const item = await M().create({ data });
    res.status(201).json(item);
}));

  r.put("/:id", authMw, E, asyncHandler(async (req: Request, res: Response) => {
    if (cfg.guardUpdate) await cfg.guardUpdate(req.params.id as string, req.body);
    const data = transformRelations(cfg, req.body);
    const item = await M().update({ where: { [cfg.pk]: req.params.id }, data });
    res.json(item);
}));

  r.delete("/:id", authMw, D, asyncHandler(async (req: Request, res: Response) => {
    if (cfg.guardDelete) await cfg.guardDelete(req.params.id as string);
    await M().delete({ where: { [cfg.pk]: req.params.id } });
    res.status(204).send();
}));

  return r;
}


function transformRelations(cfg: CrudConfig, body: any): any {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const out: any = { ...body };
  if (cfg.relations) {
    for (const [field, info] of Object.entries(cfg.relations)) {
      if (field in out) {
        const val = out[field];
        delete out[field];
        if (val === null || val === undefined || val === "") {
          // omit on create; disconnect on update is handled by Prisma null
          out[info.relation] = null;
        } else {
          out[info.relation] = { connect: { [info.pk]: val } };
        }
      }
    }
  }
  return out;
}
