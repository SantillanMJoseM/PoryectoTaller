// ============================================================================
// Sistema Taller — Índice de la capa de servicios (TASK-0007 / AG-008)
// ============================================================================
// Punto de entrada único de la capa backend TypeScript: los módulos de la UI
// importan de aquí. La autoridad de autorización sigue siendo RLS en Supabase
// (migraciones 0003/0004); esta capa valida, compone flujos de negocio y
// traduce errores a mensajes en español.
// ============================================================================

import { clientesService } from "./clientes";
import { productosService } from "./productos";
import { serviciosService } from "./servicios";
import { ordenesService } from "./ordenes";
import { ventasService } from "./ventas";
import { garantiasService } from "./garantias";
import { financieroService } from "./financiero";
import { archivosService } from "./archivos";
import { catalogosService } from "./catalogos";
import { usuariosService, permisosService, puedeAcceder, puedeVerModulo, sesionesService } from "./usuarios";
import { autenticacionService, sesionesTabla, type SesionAdmin } from "./autenticacion";
import { reportesService, type TipoReporte, type FiltrosReporte, type Reporte, type Columna } from "./reportes";
import { auditoriaService } from "./auditoria";
import { emailsService } from "./emails";
import { empresaService, cabeceraEmpresa } from "./empresa";
import { panelService, ACCESOS_RAPIDOS, type ResumenPanel } from "./panel";
import { portalService, type SesionPortal } from "./portal";

export {
  clientesService,
  productosService,
  serviciosService,
  ordenesService,
  ventasService,
  garantiasService,
  financieroService,
  archivosService,
  catalogosService,
  usuariosService,
  permisosService,
  sesionesService,
  autenticacionService,
  sesionesTabla,
  reportesService,
  auditoriaService,
  emailsService,
  empresaService,
  cabeceraEmpresa,
  panelService,
  ACCESOS_RAPIDOS,
  portalService,
  puedeAcceder,
  puedeVerModulo,
};

export type { SesionAdmin, SesionPortal, ResumenPanel, TipoReporte, FiltrosReporte, Reporte, Columna };
