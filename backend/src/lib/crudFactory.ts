import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { prisma } from "./prisma.js";
import { HttpError } from "../middleware/error.js";

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
  r.get("/", authMw, V, async (req: Request, res: Response) => {
    try {
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
        where[k] = v;
      }
      const orderBy: any = {};
      if (req.query.columna) orderBy[req.query.columna as string] = (req.query.ascendente === "true") ? "asc" : "desc";
      const [data, total] = await Promise.all([
        M().findMany({ where, skip, take: size, orderBy: Object.keys(orderBy).length ? orderBy : undefined }),
        M().count({ where }),
      ]);
      res.json({ datos: data, total, pagina: page, tamPagina: size, paginas: Math.max(1, Math.ceil(total / size)) });
    } catch (e) { throw e; }
  });

  r.get("/count", authMw, V, async (req: Request, res: Response) => {
    const where: any = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (v === undefined || v === null || v === "") continue;
      where[k] = v;
    }
    const c = await M().count({ where });
    res.json({ count: c });
  });

  r.get("/:id", authMw, V, async (req: Request, res: Response) => {
    const item = await M().findUnique({ where: { [cfg.pk]: req.params.id } });
    if (!item) throw new HttpError(404, "No encontrado.");
    res.json(item);
  });

  r.post("/", authMw, A, async (req: Request, res: Response) => {
    const item = await M().create({ data: req.body });
    res.status(201).json(item);
  });

  r.put("/:id", authMw, E, async (req: Request, res: Response) => {
    if (cfg.guardUpdate) await cfg.guardUpdate(req.params.id as string, req.body);
    const item = await M().update({ where: { [cfg.pk]: req.params.id }, data: req.body });
    res.json(item);
  });

  r.delete("/:id", authMw, D, async (req: Request, res: Response) => {
    if (cfg.guardDelete) await cfg.guardDelete(req.params.id as string);
    await M().delete({ where: { [cfg.pk]: req.params.id } });
    res.status(204).send();
  });

  return r;
}
