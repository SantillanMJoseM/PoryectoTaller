// ============================================================================
// Sistema Taller — QA: Órdenes de trabajo (TASK-0010 / AG-012)
// ============================================================================
// SOURCE_PROMPT.md §5 flujos críticos cubiertos:
//   • Validación de alta/edición (cliente/usuario/estado/fechas en español).
//   • Estados únicamente del dominio permitido.
//   • Control de stock por RPC (agregar descuenta; cambiar/quitar devuelven).
//   • Líneas de servicio con subtotal y recálculo de total.
//   • Facturación única vía orden_facturar (movimiento financiero ×1 vez).
//   • Envío por correo → cola_emails con estado «pendiente».
//   • Anexos en Storage bucket «anexos-orden» con ruta sanitizada.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";
import { falso } from "../helpers/supabaseFalso";
import { ordenesService } from "../../src/services/ordenes";
import { hoyISO } from "../../src/lib/fechas";

vi.mock("../../src/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/supabase")>();
  const mod = await import("../helpers/supabaseFalso");
  return { ...original, supabase: mod.falso.supabase };
});

beforeEach(() => {
  falso.limpiar();
  falso.establecer("clientes", [{ id_cliente: "cli-1", nombre_cliente: "Juan Pérez" }]);
  falso.establecer("usuarios", [{ id_usuario: "usu-1", nombre: "Técnico Uno" }]);
});

describe("alta y edición de órdenes (validaciones)", () => {
  it("rechaza alta sin cliente / usuario / fecha con mensajes en español", async () => {
    await expect(
      ordenesService.crear({ descripcion_producto: "Radio GX-200" } as any),
    ).rejects.toThrow(/Datos inválidos/);
  });

  it("alta correcta con fecha por defecto = hoy (validador exige estado del dominio)", async () => {
    const orden = await ordenesService.crear({
      cliente_id: "cli-1",
      usuario_id: "usu-1",
      estado: "Abierta",
      fecha_inicial: undefined,
    } as any);
    expect(orden.fecha_inicial).toBe(hoyISO());
    expect(orden.estado).toBe("Abierta");
    expect(falso.filas("ordenes_trabajo")).toHaveLength(1);
  });

  it("rechaza estados fuera del dominio del prompt", async () => {
    falso.establecer("ordenes_trabajo", [
      { id_orden: "o-1", estado: "Abierta", fecha_inicial: "2026-01-10", cliente_id: "cli-1" },
    ]);
    await expect(ordenesService.cambiarEstado("o-1", "Cerrada" as any)).rejects.toThrow(
      "Estado de orden inválido.",
    );
    await ordenesService.cambiarEstado("o-1", "Aguardando Piezas");
    expect(falso.filas("ordenes_trabajo")[0].estado).toBe("Aguardando Piezas");
  });
});

describe("stock desde las líneas de la orden (RPC de la migración 0004)", () => {
  beforeEach(() => {
    falso.establecer("ordenes_trabajo", [
      { id_orden: "o-1", estado: "Abierta", fecha_inicial: "2026-01-10", cliente_id: "cli-1" },
    ]);
  });

  it("orden_agregar_producto recibe orden, producto y cantidad exactos", async () => {
    await ordenesService.agregarProducto("o-1", "pro-9", 2, 15.5);
    const llamada = falso.ultimaRpc("orden_agregar_producto");
    expect(llamada?.args).toEqual({ p_orden: "o-1", p_producto: "pro-9", p_cantidad: 2, p_precio: 15.5 });
  });

  it("cantidad 0 o negativa se rechaza antes de tocar la base", async () => {
    await expect(ordenesService.agregarProducto("o-1", "pro-9", 0)).rejects.toThrow(
      "La cantidad debe ser mayor que cero.",
    );
    expect(falso.rpcLlamadas).toHaveLength(0);
  });

  it("cambiar cantidad y quitar producto usan sus RPC (devolución de stock en BD)", async () => {
    await ordenesService.cambiarCantidadProducto("lin-1", 5);
    expect(falso.ultimaRpc("orden_cambiar_cantidad_producto")?.args).toEqual({
      p_linea: "lin-1",
      p_cantidad: 5,
    });
    await expect(ordenesService.cambiarCantidadProducto("lin-1", -3)).rejects.toThrow(/mayor que cero/);
    await ordenesService.quitarProducto("lin-2");
    expect(falso.ultimaRpc("orden_quitar_producto")?.args).toEqual({ p_linea: "lin-2" });
  });

  it("servicios: subtotal redondeado a 2 decimales, sin efecto en stock", async () => {
    const linea = await ordenesService.agregarServicio("o-1", { id_servicio: "s-1", nombre: "Mano de obra", precio: 10.005 }, 3);
    expect(linea.subtotal).toBe(30.02); // 3 × 10.005 = 30.015 → 30.02 (RB: 2 decimales)
    const fila = falso.filas("servicios_orden")[0];
    expect(fila).toMatchObject({ orden_id: "o-1", servicio_id: "s-1", cantidad: 3, precio: 10.005 });
    expect(falso.rpcLlamadas).toHaveLength(0); // servicios no tocan stock
  });

  it("cálculo del total = suma de subtotales (productos + servicios)", async () => {
    falso.establecer("productos_orden", [
      { id_producto_orden: "p-1", orden_id: "o-1", subtotal: 31 },
      { id_producto_orden: "p-2", orden_id: "o-1", subtotal: 9.5 },
    ]);
    falso.establecer("servicios_orden", [{ id_servicio_orden: "s-1", orden_id: "o-1", subtotal: 20 }]);
    await expect(ordenesService.calcularTotal("o-1")).resolves.toBe(60.5);
  });
});

describe("facturación única de la orden", () => {
  beforeEach(() => {
    falso.establecer("ordenes_trabajo", [
      { id_orden: "o-1", estado: "Finalizado", fecha_inicial: "2026-01-10", cliente_id: "cli-1", facturado: false },
    ]);
  });

  it("orden_facturar se llama con los parámetros de la migración 0004", async () => {
    await ordenesService.facturar("o-1", { formaPago: "Efectivo", categoriaId: "cat-1", cuentaId: "cta-1", fechaVencimiento: "2026-02-01" });
    expect(falso.ultimaRpc("orden_facturar")?.args).toEqual({
      p_orden: "o-1",
      p_fecha_vencimiento: "2026-02-01",
      p_forma_pago: "Efectivo",
      p_categoria_id: "cat-1",
      p_cuenta_id: "cta-1",
    });
  });

  it("RPC escéptica: si la base rechaza el segundo intento, el error sube en español", async () => {
    falso.rpc("orden_facturar", () => {
      throw new Error("La orden ya fue facturada.");
    });
    await expect(ordenesService.facturar("o-1")).rejects.toThrow("La orden ya fue facturada.");
  });
});

describe("envío de la orden por correo (cola de emails)", () => {
  it("encola en cola_emails con estado pendiente y encabezados orden:<id>", async () => {
    falso.establecer("ordenes_trabajo", [
      { id_orden: "orden-abc-123", estado: "Finalizado", valor_total: 100, cliente_id: "cli-1", clientes: { correo: "j@x.com" } },
    ]);
    await ordenesService.enviarPorCorreo("orden-abc-123", "cliente@correo.com");
    const fila = falso.filas("cola_emails")[0];
    expect(fila).toMatchObject({
      para: "cliente@correo.com",
      estado: "pendiente",
      encabezados: "orden:orden-abc-123",
    });
    expect(fila.mensaje).toContain("Orden ORDEN-AB"); // resumen con prefijo visible
  });

  it("orden inexistente → error explícito", async () => {
    await expect(ordenesService.enviarPorCorreo("no-existe", "a@b.com")).rejects.toThrow("Orden inexistente.");
    expect(falso.filas("cola_emails")).toHaveLength(0);
  });
});

describe("anexos de la orden (Storage «anexos-orden»)", () => {
  beforeEach(() => {
    falso.establecer("ordenes_trabajo", [
      { id_orden: "o-1", estado: "Abierta", cliente_id: "cli-1" },
    ]);
  });

  it("sube al bucket privado con ruta sanitizada <orden>/<uuid>-<nombre>", async () => {
    // File es global en Node moderno; respaldo mínimo si el entorno no lo provee.
    const archivo =
      typeof File === "function"
        ? new File(["datos"], "laudo final (1).pdf")
        : ({ name: "laudo final (1).pdf" } as unknown as File);
    const anexo = await ordenesService.adjuntarAnexo("o-1", archivo);
    expect(falso.subidas).toHaveLength(1);
    expect(falso.subidas[0].bucket).toBe("anexos-orden");
    expect(falso.subidas[0].ruta).toMatch(/^o-1\/[0-9a-f-]{36}-laudo_final__1_\.pdf$/);
    expect(anexo.ruta).toBe(falso.subidas[0].ruta);
    expect(falso.filas("anexos")[0].anexo).toBe("laudo final (1).pdf");
  });

  it("quitarAnexo borra objeto de Storage y fila de anexos", async () => {
    falso.establecer("anexos", [{ id_anexo: "a-1", orden_id: "o-1", ruta: "o-1/xyz", anexo: "f.png" }]);
    await ordenesService.quitarAnexo("a-1", "o-1/xyz");
    expect(falso.borradosStorage).toEqual([{ bucket: "anexos-orden", ruta: "o-1/xyz" }]);
    expect(falso.filas("anexos")).toHaveLength(0);
  });
});
