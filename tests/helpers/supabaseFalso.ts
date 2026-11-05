// ============================================================================
// Sistema Taller — Supabase simulado para QA (TASK-0010 / AG-012)
// ============================================================================
// Motor falso in-memory del cliente @supabase/supabase-js que usan las pruebas
// de flujos críticos (tests/integration/**). Implementa el subconjunto que la
// capa de servicios (src/lib/crud.ts, src/services/**) realmente usa:
//   • from(tabla).select/eq/neq/ilike/or/gte/lte/range/order/limit
//     → thenable: resolves  { data, error, count }
//   • insert/update/delete (+ .select().single()/.maybeSingle())
//   • rpc(fn, args)            → manejable por prueba + registro de llamadas
//   • functions.invoke(fn,{body}) → manejable por prueba (Edge Functions)
//   • auth.signInWithPassword/signOut/setSession/getSession
//   • storage.from(bucket).upload/createSignedUrl/remove/download
// Todo registra llamadas (rpcLlamadas, subidas, llamadasAuth) para que las
// pruebas verifiquen contratos: nombres de RPC, argumentos, buckets, estados.
// ============================================================================

import { vi } from "vitest";

export type Fila = Record<string, any>;

/* ---------------------------- Clave primaria ------------------------------ */
/* Tabla → PK (según la migración 0001_init.sql; nombres en español). */
export const PKS: Record<string, string> = {
  empresa: "id",
  permisos: "id_permiso",
  usuarios: "id_usuario",
  clientes: "id_cliente",
  marcas: "id_marca",
  equipos: "id_equipo",
  productos: "id_producto",
  servicios: "id_servicio",
  garantias: "id_garantia",
  categorias: "id_categoria",
  cuentas: "id_cuenta",
  ordenes_trabajo: "id_orden",
  productos_orden: "id_producto_orden",
  servicios_orden: "id_servicio_orden",
  equipos_orden: "id_equipo_orden",
  anexos: "id_anexo",
  ventas: "id_venta",
  items_venta: "id_item_venta",
  movimientos_financieros: "id_movimiento",
  documentos: "id_documento",
  logs_auditoria: "id_log",
  cola_emails: "id",
  sesiones: "id_sesion",
};

function nuevoId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "id-" + Math.random().toString(16).slice(2);
}

/** sql/ilike difuso: «%patrón%» tolera escapes \\ de crud.ts. */
function coincideIlike(valor: unknown, patron: string): boolean {
  const nucleo = String(patron).toLowerCase().replace(/^%/, "").replace(/%$/, "").replace(/\\(.)/g, "$1");
  return String(valor ?? "").toLowerCase().includes(nucleo);
}

type Paso =
  | { tipo: "eq"; c: string; v: unknown }
  | { tipo: "neq"; c: string; v: unknown }
  | { tipo: "ilike"; c: string; v: string }
  | { tipo: "or"; expresion: string }
  | { tipo: "gte"; c: string; v: unknown }
  | { tipo: "lte"; c: string; v: unknown }
  | { tipo: "range"; desde: number; hasta: number }
  | { tipo: "order"; c: string; ascendente: boolean }
  | { tipo: "limit"; n: number };

type Accion =
  | { tipo: "select" }
  | { tipo: "insert"; vals: Fila | Fila[] }
  | { tipo: "update"; vals: Fila }
  | { tipo: "delete" };

interface ConsultaLike extends PromiseLike<any> {
  select(sel?: string, opciones?: Record<string, unknown>): ConsultaLike;
  eq(c: string, v: unknown): ConsultaLike;
  neq(c: string, v: unknown): ConsultaLike;
  ilike(c: string, v: string): ConsultaLike;
  or(expresion: string): ConsultaLike;
  gte(c: string, v: unknown): ConsultaLike;
  lte(c: string, v: unknown): ConsultaLike;
  range(desde: number, hasta: number): ConsultaLike;
  order(c: string, opciones?: { ascending?: boolean }): ConsultaLike;
  limit(n: number): ConsultaLike;
  single(): ConsultaLike;
  maybeSingle(): ConsultaLike;
}

export function crearFalsoSupabase() {
  const db: Record<string, Fila[]> = {};
  const rpcLlamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const rpcMap = new Map<string, (args: any) => any>();
  const invokeMap = new Map<string, (cuerpo: any) => any>();
  const llamadasAuth: string[] = [];
  const subidas: { bucket: string; ruta: string }[] = [];
  const borradosStorage: { bucket: string; ruta: string }[] = [];
  const consultaLog: { tabla: string; operacion: string }[] = [];
  const estadoAuth = {
    usuario: null as null | { id: string; email: string },
    errorIniciar: null as null | { message: string },
  };

  class Consulta implements ConsultaLike {
    private _pasos: Paso[] = [];
    private _accion: Accion = { tipo: "select" };
    private _modo: "todos" | "single" | "maybeSingle" = "todos";
    private _contarExacto = false;

    constructor(private _tabla: string) {}

    private _clon(): Consulta {
      const c = Object.create(Object.getPrototypeOf(this)) as Consulta;
      c._tabla = this._tabla;
      c._pasos = [...this._pasos];
      c._accion = this._accion;
      c._modo = this._modo;
      c._contarExacto = this._contarExacto;
      return c;
    }

    select(_sel?: string, opciones?: Record<string, unknown>): ConsultaLike {
      this._contarExacto = (opciones as { count?: string } | undefined)?.count === "exact";
      return this;
    }
    single(): ConsultaLike {
      const c = this._clon();
      c._modo = "single";
      return c;
    }
    maybeSingle(): ConsultaLike {
      const c = this._clon();
      c._modo = "maybeSingle";
      return c;
    }
    eq(c: string, v: unknown): ConsultaLike {
      this._pasos.push({ tipo: "eq", c, v });
      return this;
    }
    neq(c: string, v: unknown): ConsultaLike {
      this._pasos.push({ tipo: "neq", c, v });
      return this;
    }
    ilike(c: string, v: string): ConsultaLike {
      this._pasos.push({ tipo: "ilike", c, v });
      return this;
    }
    or(expresion: string): ConsultaLike {
      this._pasos.push({ tipo: "or", expresion });
      return this;
    }
    gte(c: string, v: unknown): ConsultaLike {
      this._pasos.push({ tipo: "gte", c, v });
      return this;
    }
    lte(c: string, v: unknown): ConsultaLike {
      this._pasos.push({ tipo: "lte", c, v });
      return this;
    }
    range(desde: number, hasta: number): ConsultaLike {
      this._pasos.push({ tipo: "range", desde, hasta });
      return this;
    }
    order(c: string, opciones?: { ascending?: boolean }): ConsultaLike {
      this._pasos.push({ tipo: "order", c, ascendente: opciones?.ascending ?? true });
      return this;
    }
    limit(n: number): ConsultaLike {
      this._pasos.push({ tipo: "limit", n });
      return this;
    }
    insert(vals: Fila | Fila[]): ConsultaLike {
      this._accion = { tipo: "insert", vals };
      return this;
    }
    update(vals: Fila): ConsultaLike {
      this._accion = { tipo: "update", vals };
      return this;
    }
    delete(): ConsultaLike {
      this._accion = { tipo: "delete" };
      return this;
    }

    /** Filas de db[tabla] que pasan los filtros acumulados (igual que RLS-less PostgREST). */
    private _filasFiltradas(): Fila[] {
      let filas = [...(db[this._tabla] ?? [])];
      for (const paso of this._pasos) {
        switch (paso.tipo) {
          case "eq":
            filas = filas.filter((f) => f[paso.c] === paso.v);
            break;
          case "neq":
            filas = filas.filter((f) => f[paso.c] !== paso.v);
            break;
          case "ilike":
            filas = filas.filter((f) => coincideIlike(f[paso.c], paso.v));
            break;
          case "or": {
            const partes = paso.expresion.split(",").map((p) => p.trim()).filter(Boolean);
            filas = filas.filter((f) =>
              partes.some((p) => {
                const [col, op, ...resto] = p.split(".");
                const valor = resto.join(".");
                if (op === "ilike") return coincideIlike(f[col], valor);
                if (op === "eq") return f[col] === valor;
                return false;
              }),
            );
            break;
          }
          case "gte":
            filas = filas.filter((f) => String(f[paso.c] ?? "") >= String(paso.v));
            break;
          case "lte":
            filas = filas.filter((f) => String(f[paso.c] ?? "") <= String(paso.v));
            break;
          default:
            break; // range/order/limit se aplican después
        }
      }
      return filas;
    }

    private _ejecutar(): Promise<{ data: any; error: null; count: number | null }> {
      let filas: Fila[];
      let total = 0;

      if (this._accion.tipo === "insert") {
        const valores = (Array.isArray(this._accion.vals) ? this._accion.vals : [this._accion.vals]).map(
          (v) => ({ ...v }),
        );
        const pk = PKS[this._tabla];
        for (const v of valores) if (pk && v[pk] === undefined) v[pk] = nuevoId();
        db[this._tabla] = [...(db[this._tabla] ?? []), ...valores];
        filas = valores;
        total = valores.length;
      } else if (this._accion.tipo === "update") {
        filas = this._filasFiltradas();
        for (const f of filas) Object.assign(f, this._accion.vals);
        total = filas.length;
      } else if (this._accion.tipo === "delete") {
        filas = this._filasFiltradas();
        db[this._tabla] = (db[this._tabla] ?? []).filter((f) => !filas.includes(f));
        total = filas.length;
      } else {
        filas = this._filasFiltradas();
        total = filas.length;
      }

      for (const paso of [...this._pasos].reverse().filter((p) => p.tipo === "order")) {
        const orden = paso as Extract<Paso, { tipo: "order" }>;
        filas = [...filas].sort((a, b) => {
          const x = String(a[orden.c] ?? "");
          const y = String(b[orden.c] ?? "");
          return orden.ascendente ? x.localeCompare(y) : y.localeCompare(x);
        });
        break;
      }
      let rango: Extract<Paso, { tipo: "range" }> | null = null;
      let tope: Extract<Paso, { tipo: "limit" }> | null = null;
      for (const paso of this._pasos) {
        if (paso.tipo === "range") rango = paso;
        if (paso.tipo === "limit") tope = paso;
      }
      if (rango) filas = filas.slice(rango.desde, rango.hasta + 1);
      if (tope) filas = filas.slice(0, tope.n);

      let data: any = filas;
      if (this._modo === "single") data = filas.length === 1 ? filas[0] : null;
      if (this._modo === "maybeSingle") data = filas.length > 0 ? filas[0] : null;
      // head:true → sin filas; Pruebas usan count.
      const soloContar = this._contarExacto && filas.length === 0 && total > 0;
      return Promise.resolve({ data: soloContar ? [] : data, error: null, count: this._contarExacto ? total : null });
    }

    then<TResult1 = any, TResult2 = never>(
      onok?: ((v: any) => TResult1 | PromiseLike<TResult1>) | null,
      onerr?: ((e: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      consultaLog.push({ tabla: this._tabla, operacion: this._accion.tipo });
      return this._ejecutar().then(
        (v) => (onok ? onok(v) : (v as TResult1)),
        (e) => (onerr ? onerr(e) : ((Promise.reject(e) as unknown) as TResult2)),
      );
    }
  }

  const supabase = {
    from(tabla: string) {
      return new Consulta(tabla) as unknown as any;
    },
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      rpcLlamadas.push({ fn, args });
      const manejador = rpcMap.get(fn);
      if (!manejador) return { data: null, error: null };
      try {
        return { data: (await manejador(args)) ?? null, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    functions: {
      async invoke(fn: string, { body }: { body?: unknown } = {}) {
        const manejador = invokeMap.get(fn);
        if (!manejador) return { data: null, error: { message: "Function not found" } };
        try {
          return (await manejador(body)) ?? { data: null, error: null };
        } catch (e) {
          return { data: null, error: { message: (e as Error).message } };
        }
      },
    },
    auth: {
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        llamadasAuth.push(`signInWithPassword:${email}`);
        if (estadoAuth.errorIniciar)
          return { data: { user: null }, error: estadoAuth.errorIniciar };
        if (!estadoAuth.usuario) return { data: { user: null }, error: { message: "Invalid login credentials" } };
        return { data: { user: { id: estadoAuth.usuario.id, email } }, error: null };
      },
      async signOut() {
        llamadasAuth.push("signOut");
        return { error: null };
      },
      async setSession(sesion: { access_token: string; refresh_token: string }) {
        llamadasAuth.push(`setSession:${Boolean(sesion?.access_token)}`);
        return { data: { session: { ...sesion } }, error: null };
      },
      async getSession() {
        llamadasAuth.push("getSession");
        const u = estadoAuth.usuario;
        return { data: { session: u ? { user: { id: u.id, email: u.email } } : null }, error: null };
      },
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(ruta: string, _archivo: unknown, _opts?: unknown) {
            subidas.push({ bucket, ruta });
            return { data: { path: ruta }, error: null };
          },
          // Firma síncrona: refleja el uso que hace src/services/ordenes.ts.
          createSignedUrl(ruta: string, _segundos: number) {
            return { data: { signedUrl: `https://falso.supabase/firmada/${bucket}/${ruta}` }, error: null };
          },
          async remove(rutas: string[]) {
            for (const ruta of rutas) borradosStorage.push({ bucket, ruta });
            return { data: null, error: null };
          },
          async download(ruta: string) {
            return { data: new Blob(["contenido-falso:" + ruta]), error: null };
          },
        };
      },
    },
  };

  return {
    supabase,
    db,
    pks: PKS,
    rpcLlamadas,
    rpcMap,
    invokeMap,
    llamadasAuth,
    subidas,
    borradosStorage,
    consultaLog,
    estadoAuth,
    /** Siembra filas de una tabla (copia profunda superficial). */
    establecer(tabla: string, filas: Fila[]) {
      db[tabla] = filas.map((f) => ({ ...f }));
    },
    /** Filas actuales (referencia real — los updates && delete mutan aquí). */
    filas(tabla: string): Fila[] {
      return db[tabla] ?? [];
    },
    /** Registra el resultado de una función RPC de la migración 0004. */
    rpc(fn: string, impl: (args: any) => any) {
      rpcMap.set(fn, impl);
    },
    /** Registra el resultado de una Edge Function (emails / portal-login). */
    invocable(fn: string, impl: (cuerpo: any) => any) {
      invokeMap.set(fn, impl);
    },
    /** Última llamada RPC para un nombre dado (o null). */
    ultimaRpc(fn: string): { fn: string; args: Record<string, unknown> } | null {
      const lista = rpcLlamadas.filter((l) => l.fn === fn);
      return lista.length ? lista[lista.length - 1] : null;
    },
    limpiar() {
      for (const k of Object.keys(db)) delete db[k];
      rpcLlamadas.length = 0;
      rpcMap.clear();
      invokeMap.clear();
      llamadasAuth.length = 0;
      subidas.length = 0;
      borradosStorage.length = 0;
      consultaLog.length = 0;
      estadoAuth.usuario = null;
      estadoAuth.errorIniciar = null;
    },
  };
}

// Singleton por archivo de prueba: vi.mock lo usa la fábrica y las pruebas
// importan `falso` para sembrar datos / revisar llamadas.
export const falso = { ...crearFalsoSupabase() };
export const supabaseFalso = falso.supabase;

// Espía sencillo para pruebas que solo quieren registrar (vi.fn equivalente).
export const espia = vi;
