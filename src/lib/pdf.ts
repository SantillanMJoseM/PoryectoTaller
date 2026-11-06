// ============================================================================
// Sistema Taller — Generación de PDF (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md: «Generación de PDF con encabezado de empresa, datos
// tabulados y paginación» y «Los reportes PDF deben usar los datos de la
// empresa» (RB-030). Se usa jsPDF (Stack del prompt: jsPDF o react-pdf).
// Composición: A4 vertical, encabezado con nombre/dirección/contacto de la
// empresa, título del documento, tabla con saltos de página automáticos y pie
// con número de página + fecha de generación.
// ============================================================================

import jsPDF from "jspdf";
import { formatoFecha } from "./fechas";
import { formatoDinero } from "./dinero";

export interface DatosEmpresaPdf {
  nombre?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  logo?: string;
}

export interface ColumnaPdf {
  clave: string;
  titulo: string;
  ancho: number; // mm sobre el cuerpo A4 (190 mm)
  tipo?: "texto" | "dinero" | "fecha" | "numero";
}

export interface OpcionesPdfTabla {
  titulo: string;
  empresa?: DatosEmpresaPdf;
  columnas: ColumnaPdf[];
  filas: Record<string, unknown>[];
  nota?: string;
  subtitulo?: string;
  /** Bloques de texto libres tras la tabla (datos de cliente, totales…). */
  extras?: string[];
  /** Fila final destacada, p. ej. «TOTAL …». */
  pie?: { texto: string; valor: string };
}

const MARGEN = 14;
const ANCHO_UTIL = 190;
const LIMITE_Y = 272;

function marcarTiempo(): string {
  return new Date().toLocaleString("es-ES");
}

function textoValor(valor: unknown, tipo: ColumnaPdf["tipo"]): string {
  switch (tipo) {
    case "dinero":
      return formatoDinero(Number(valor ?? 0));
    case "fecha":
      return typeof valor === "string" ? formatoFecha(valor) : "";
    case "numero":
      return String(valor ?? "");
    default:
      return valor === null || valor === undefined ? "" : String(valor);
  }
}

/** Encabezado de empresa + título. Devuelve la Y donde sigue el contenido. */
function dibujarCabecera(doc: jsPDF, opciones: OpcionesPdfTabla): number {
  const e = opciones.empresa;
  // Logo (si viene como data URL) en la esquina superior derecha.
  if (e?.logo) {
    try {
      doc.addImage(e.logo, MARGEN + ANCHO_UTIL - 34, 8, 30, 16);
    } catch {
      // Si el formato no es soportado, se omite el logo sin romper el PDF.
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(e?.nombre || "Sistema Taller", MARGEN, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let y = 21;
  if (e?.direccion) {
    doc.text(e.direccion, MARGEN, y);
    y += 4;
  }
  const contacto = [e?.telefono ? `Tel.: ${e.telefono}` : "", e?.correo ?? ""].filter(Boolean).join(" · ");
  if (contacto) {
    doc.text(contacto, MARGEN, y);
    y += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const yTitulo = Math.max(y + 2, 28);
  doc.text(opciones.titulo, MARGEN, yTitulo);
  if (opciones.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70);
    doc.text(opciones.subtitulo, MARGEN, yTitulo + 5);
    doc.setTextColor(0);
  }
  doc.setDrawColor(180);
  doc.line(MARGEN, 45, MARGEN + ANCHO_UTIL, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return 48;
}

function filaEncabezado(doc: jsPDF, y: number, columnas: ColumnaPdf[]): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setFillColor(235, 235, 235);
  doc.rect(MARGEN, y - 3, ANCHO_UTIL, 7, "F");
  let x = MARGEN;
  for (const c of columnas) {
    doc.text(c.titulo, x + 1.5, y + 2);
    x += c.ancho;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  return y + 7;
}

/** Tabla con salto de página. Devuelve la Y final y el n.º de páginas creadas. */
function dibujarTabla(
  doc: jsPDF,
  opciones: OpcionesPdfTabla,
  yInicial: number,
): { y: number } {
  let y = yInicial;
  y = filaEncabezado(doc, y, opciones.columnas);
  for (const fila of opciones.filas) {
    let alto = 5;
    const celdas: string[] = [];
    for (const c of opciones.columnas) {
      const t = doc.splitTextToSize(textoValor(fila[c.clave], c.tipo), c.ancho - 2) as string[];
      celdas.push(t[0] ?? "");
      alto = Math.max(alto, t.length * 4);
    }
    if (y + alto > LIMITE_Y) {
      doc.addPage();
      y = dibujarCabecera(doc, opciones);
      y = filaEncabezado(doc, y, opciones.columnas);
    }
    let x = MARGEN;
    for (let i = 0; i < opciones.columnas.length; i++) {
      doc.text(celdas[i], x + 1.5, y + 2);
      x += opciones.columnas[i].ancho;
    }
    doc.setDrawColor(230);
    doc.line(MARGEN, y + alto - 1, MARGEN + ANCHO_UTIL, y + alto - 1);
    y += alto;
  }
  return { y };
}

/** Bloques de texto libres (datos principales de un documento). */
function dibujarExtras(doc: jsPDF, yInicio: number, extras: string[]): number {
  doc.setFontSize(9);
  let y = yInicio;
  for (const b of extras) {
    if (y > LIMITE_Y) {
      doc.addPage();
      y = 20;
    }
    const lineas = doc.splitTextToSize(b, ANCHO_UTIL) as string[];
    doc.text(lineas, MARGEN, y);
    y += lineas.length * 4.5 + 2;
  }
  return y;
}

/** Fila final destacada (TOTAL). */
function dibujarPie(doc: jsPDF, y: number, pie: { texto: string; valor: string }): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${pie.texto}: ${pie.valor}`, MARGEN + ANCHO_UTIL - 60, Math.min(y + 6, LIMITE_Y));
  doc.setFont("helvetica", "normal");
}

/** Ruta de pie de página y marca de tiempo en todas las hojas. */
function estamparPies(doc: jsPDF, nota?: string): void {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${n}`, MARGEN, 290);
    if (i === n && nota) doc.text(nota, MARGEN, 285);
    doc.text(`Generado: ${marcarTiempo()}`, MARGEN + ANCHO_UTIL - 55, 290);
    doc.setTextColor(0);
  }
  doc.setPage(1);
}

/** Reporte tabular completo (Informes/Reportes, listados impresos). */
export function generarPdfTabla(opciones: OpcionesPdfTabla): jsPDF {
  const doc = new jsPDF();
  const y0 = dibujarCabecera(doc, opciones);
  let { y } = dibujarTabla(doc, opciones, y0);
  const extras = opciones.extras ?? [];
  if (extras.length > 0) {
    y += 4;
    y = dibujarExtras(doc, y, extras);
  }
  if (opciones.pie) {
    dibujarPie(doc, y + 2, opciones.pie);
  }
  estamparPies(doc, opciones.nota);
  return doc;
}

/** Documento de negocio (orden de trabajo o venta) con líneas y total. */
export function pdfDocumento(
  titulo: string,
  subtitulo: string,
  empresa: DatosEmpresaPdf,
  datosExtras: string[],
  lineas: Record<string, unknown>[],
  total: number,
): jsPDF {
  const columnas: ColumnaPdf[] = [
    { clave: "descripcion", titulo: "Descripción", ancho: 80 },
    { clave: "cantidad", titulo: "Cant.", ancho: 20, tipo: "numero" },
    { clave: "precio", titulo: "Precio", ancho: 42, tipo: "dinero" },
    { clave: "subtotal", titulo: "Subtotal", ancho: 48, tipo: "dinero" },
  ];
  return generarPdfTabla({
    titulo,
    subtitulo,
    empresa,
    columnas,
    filas: lineas,
    extras: datosExtras,
    pie: { texto: "TOTAL", valor: formatoDinero(total) },
  });
}

/** Término de garantía impreso (texto libre). */
export function pdfGarantia(
  empresa: DatosEmpresaPdf,
  titulo: string,
  subtitulo: string,
  bloques: string[],
): jsPDF {
  const doc = new jsPDF();
  const y0 = dibujarCabecera(doc, { titulo, subtitulo, empresa });
  dibujarExtras(doc, y0 + 4, bloques);
  estamparPies(doc, "Documento impreso desde Sistema Taller");
  return doc;
}

/** Descarga el PDF con el nombre de archivo dado. */
export function descargarPdf(doc: jsPDF, nombreArchivo: string): void {
  doc.save(nombreArchivo);
}

/** Abre el PDF en línea (pestaña nueva) para su visualización. */
export function abrirPdf(doc: jsPDF): void {
  const url = doc.output("bloburl");
  window.open(String(url), "_blank", "noopener");
}
