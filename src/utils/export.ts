import * as XLSX from 'xlsx';
import { ScannedItem } from '../types';

/**
 * Formatea una marca de tiempo en formato legible en español (DD/MM/YYYY HH:mm:ss)
 */
export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

/**
 * Formatea una marca de tiempo breve para mostrar en las filas de la lista
 */
export function formatShortDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

/**
 * Genera el nombre de archivo con la fecha actual
 */
function getExportFilename(extension: 'csv' | 'xlsx'): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `inventario-codigos-${yyyy}${mm}${dd}-${hh}${min}.${extension}`;
}

/**
 * Exporta la lista de códigos escaneados a un archivo CSV compatible con Excel (incluye BOM UTF-8).
 */
export function exportToCSV(items: ScannedItem[]): void {
  if (items.length === 0) return;

  const headers = ['Código', 'Nombre / Nota', 'Cantidad', 'Formato', 'Última actualización'];

  const escapeCSV = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes('"') || str.includes(',') || str.includes(';') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = items.map((item) => [
    escapeCSV(item.code),
    escapeCSV(item.note || ''),
    escapeCSV(item.quantity),
    escapeCSV(item.format),
    escapeCSV(formatDateTime(item.updatedAt)),
  ]);

  // Usamos coma estándar y BOM UTF-8 para máxima compatibilidad con Excel y Google Sheets
  const csvContent =
    '\uFEFF' +
    [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', getExportFilename('csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta la lista de códigos escaneados a un archivo Excel nativo (.xlsx).
 */
export function exportToExcel(items: ScannedItem[]): void {
  if (items.length === 0) return;

  const rows = items.map((item) => ({
    'Código': item.code,
    'Nombre / Nota': item.note || '',
    'Cantidad': item.quantity,
    'Formato': item.format,
    'Última actualización': formatDateTime(item.updatedAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ajustar anchos de columna para lectura cómoda en Excel
  worksheet['!cols'] = [
    { wch: 20 }, // Código
    { wch: 28 }, // Nombre / Nota
    { wch: 12 }, // Cantidad
    { wch: 14 }, // Formato
    { wch: 22 }, // Última actualización
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');

  XLSX.writeFile(workbook, getExportFilename('xlsx'));
}

/**
 * Genera el texto formateado de la lista de códigos con el formato exacto:
 * código - cantidad (ej: 2400007370133 - 3)
 */
export function formatListForMessaging(items: ScannedItem[]): string {
  if (items.length === 0) return '';

  return items.map((item) => `${item.code} - ${item.quantity}`).join('\n');
}

/**
 * Copia la lista al portapapeles en formato de lista de texto estructurada para mensajería.
 */
export async function copyListToClipboard(items: ScannedItem[]): Promise<boolean> {
  if (items.length === 0) return false;

  const text = formatListForMessaging(items);

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback clásico con textarea temporal si el navegador restringe navigator.clipboard en iframe
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }
}
