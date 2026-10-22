import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Download,
  FileSpreadsheet,
  Copy,
  Check,
  AlertTriangle,
  ScanBarcode,
  X,
  Tag,
} from 'lucide-react';
import { ScannedItem } from '../types';
import {
  exportToCSV,
  exportToExcel,
  copyListToClipboard,
  formatShortDateTime,
} from '../utils/export';

interface ListViewProps {
  items: ScannedItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onGoToScanner: () => void;
}

export const ListView: React.FC<ListViewProps> = ({
  items,
  onUpdateQuantity,
  onUpdateNote,
  onDeleteItem,
  onClearAll,
  onGoToScanner,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);

  // Filtrado en tiempo real por código, nota o formato
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        item.format.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Cálculos de totales y métricas visuales para el Resumen de Inventario
  const totalUniqueProducts = items.length;
  const totalUnits = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity, 0),
    [items]
  );

  const filteredUnits = useMemo(
    () => filteredItems.reduce((acc, item) => acc + item.quantity, 0),
    [filteredItems]
  );

  const itemsWithNoteCount = useMemo(
    () => items.filter((item) => item.note.trim().length > 0).length,
    [items]
  );

  const annotatedPercentage = useMemo(
    () =>
      totalUniqueProducts > 0
        ? Math.round((itemsWithNoteCount / totalUniqueProducts) * 100)
        : 0,
    [itemsWithNoteCount, totalUniqueProducts]
  );

  const avgUnitsPerProduct = useMemo(
    () =>
      totalUniqueProducts > 0
        ? (totalUnits / totalUniqueProducts).toFixed(1)
        : '0.0',
    [totalUnits, totalUniqueProducts]
  );

  const multiUnitCount = useMemo(
    () => items.filter((item) => item.quantity > 1).length,
    [items]
  );

  const multiUnitPercentage = useMemo(
    () =>
      totalUniqueProducts > 0
        ? Math.round((multiUnitCount / totalUniqueProducts) * 100)
        : 0,
    [multiUnitCount, totalUniqueProducts]
  );

  // Distribución de unidades por formato para la barra visual del dashboard
  const formatBreakdown = useMemo(() => {
    if (totalUnits === 0) return [];
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.format] = (counts[item.format] || 0) + item.quantity;
    }
    return Object.entries(counts)
      .map(([format, units]) => ({
        format,
        units,
        pct: Math.max(4, Math.round((units / totalUnits) * 100)),
      }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 4);
  }, [items, totalUnits]);

  // Copiar todos los elementos escaneados (o filtrados si hay búsqueda activa) al portapapeles
  const handleCopy = async () => {
    if (items.length === 0) return;
    const targetItems = searchQuery.trim() ? filteredItems : items;
    if (targetItems.length === 0) return;

    const ok = await copyListToClipboard(targetItems);
    if (ok) {
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 2600);
    }
  };

  // Parámetros de los anillos SVG (r = 22, circunferencia ≈ 138.23)
  const ringCircumference = 2 * Math.PI * 22;
  const uniqueRingOffset =
    ringCircumference - (annotatedPercentage / 100) * ringCircumference;
  const unitsRingOffset =
    ringCircumference - (multiUnitPercentage / 100) * ringCircumference;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-4 pb-28 space-y-5">
      {/* Sección: Resumen de Inventario (Dashboard visual) */}
      <section aria-labelledby="inventory-summary-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1
            id="inventory-summary-heading"
            className="text-base sm:text-lg font-bold text-white tracking-tight"
          >
            Resumen de Inventario
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums">
            <span>Media: {avgUnitsPerProduct} uds./artículo</span>
            <span aria-hidden="true">·</span>
            <span>
              {items.length > 0
                ? `Último: ${formatShortDateTime(items[0].updatedAt)}`
                : 'Sin registros'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Tarjeta 1: Artículos únicos + anillo de catalogación */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-400 block">
                Artículos únicos
              </span>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-white mt-1 tabular-nums">
                {totalUniqueProducts}
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5 truncate tabular-nums">
                {itemsWithNoteCount} con nota · {annotatedPercentage}%
              </p>
            </div>

            {/* Anillo de progreso SVG */}
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
                <circle
                  cx="26"
                  cy="26"
                  r="22"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="4.5"
                />
                <circle
                  cx="26"
                  cy="26"
                  r="22"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={uniqueRingOffset}
                />
              </svg>
              <span className="absolute font-mono text-[11px] font-semibold text-slate-200 tabular-nums">
                {annotatedPercentage}%
              </span>
            </div>
          </div>

          {/* Tarjeta 2: Suma total de unidades + anillo de stock múltiple */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-400 block">
                Suma total de unidades
              </span>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-[#60A5FA] mt-1 tabular-nums">
                {totalUnits}
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5 truncate tabular-nums">
                {multiUnitCount} con &gt;1 ud. · {avgUnitsPerProduct} media
              </p>
            </div>

            {/* Anillo de progreso SVG */}
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
                <circle
                  cx="26"
                  cy="26"
                  r="22"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="4.5"
                />
                <circle
                  cx="26"
                  cy="26"
                  r="22"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={unitsRingOffset}
                />
              </svg>
              <span className="absolute font-mono text-[11px] font-semibold text-slate-200 tabular-nums">
                {multiUnitPercentage}%
              </span>
            </div>
          </div>

          {/* Tarjeta 3: Distribución por formato + Exportación rápida */}
          <div className="col-span-2 lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium">Distribución y exportación</span>
                {formatBreakdown.length > 0 && (
                  <span className="tabular-nums text-[11px] text-slate-400">
                    {formatBreakdown
                      .map((f) => `${f.format}: ${f.units}`)
                      .join(' · ')}
                  </span>
                )}
              </div>

              {/* Barra visual de proporción de unidades */}
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex gap-0.5">
                {formatBreakdown.length > 0 ? (
                  formatBreakdown.map((entry, idx) => {
                    const barColors = [
                      'bg-[#2563EB]',
                      'bg-sky-400',
                      'bg-indigo-400',
                      'bg-slate-500',
                    ];
                    return (
                      <div
                        key={entry.format}
                        style={{ width: `${entry.pct}%` }}
                        className={`h-full ${barColors[idx % barColors.length]} transition-all`}
                        title={`${entry.format}: ${entry.units} unidades`}
                      />
                    );
                  })
                ) : (
                  <div className="w-full h-full bg-slate-800/70" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={items.length === 0}
                onClick={handleCopy}
                title="Copiar texto formateado para WhatsApp, Telegram o correo"
                className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  copiedFeedback
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                }`}
              >
                {copiedFeedback ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#2563EB] shrink-0" />
                    <span className="whitespace-nowrap">Copiar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => exportToCSV(items)}
                className="min-h-[44px] px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#2563EB] shrink-0" />
                <span className="whitespace-nowrap">CSV</span>
              </button>

              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => exportToExcel(items)}
                className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Excel</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Barra de búsqueda y acciones de lista (Copiar al portapapeles y Borrar) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código de barras, nombre o nota..."
            className="w-full min-h-[48px] pl-11 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
              className="min-w-[40px] min-h-[40px] absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={items.length === 0 || (Boolean(searchQuery.trim()) && filteredItems.length === 0)}
            onClick={handleCopy}
            className={`flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              copiedFeedback
                ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-100'
            }`}
          >
            {copiedFeedback ? (
              <>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">¡Copiado para mensajería!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#2563EB] shrink-0" />
                <span className="whitespace-nowrap">Copiar al portapapeles</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => setConfirmClearOpen(true)}
            className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-800/60 disabled:opacity-40 disabled:cursor-not-allowed text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Borrar lista</span>
          </button>
        </div>
      </div>

      {/* Estado vacío si no hay códigos */}
      {items.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-10 text-center my-4">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/15 border border-[#2563EB]/30 flex items-center justify-center mx-auto mb-4">
            <ScanBarcode className="w-7 h-7 text-[#2563EB]" />
          </div>
          <h2 className="text-base font-bold text-white">
            La lista de códigos está vacía
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Escanea productos con la cámara del móvil o añade códigos manualmente para empezar tu inventario.
          </p>
          <button
            type="button"
            onClick={onGoToScanner}
            className="mt-5 min-h-[48px] px-6 py-3 rounded-2xl bg-[#2563EB] hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ScanBarcode className="w-4 h-4" />
            <span>Ir al escáner</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 text-center">
          <p className="text-sm font-semibold text-slate-200">
            No se encontraron resultados para «{searchQuery}»
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Prueba con otro código o limpia el filtro de búsqueda.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Cabecera informativa de tabla en escritorio */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3.5 bg-slate-950/60 border-b border-slate-800 text-xs font-semibold text-slate-400">
            <div className="col-span-4">Código / Fecha y hora</div>
            <div className="col-span-4">Nombre del producto / Nota</div>
            <div className="col-span-3 text-center">Cantidad</div>
            <div className="col-span-1 text-right">Acción</div>
          </div>

          {/* Lista de filas */}
          <div className="divide-y divide-slate-800/80">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:px-5 sm:py-4 flex flex-col md:grid md:grid-cols-12 gap-3.5 md:items-center hover:bg-slate-800/25 transition-colors"
              >
                {/* Columna 1: Código y metadatos limpios sin cápsulas */}
                <div className="md:col-span-4 flex items-start justify-between md:block gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-base sm:text-lg font-bold text-white tracking-tight break-all tabular-nums">
                      {item.code}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 tabular-nums">
                      <span>{item.format}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatShortDateTime(item.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Botón eliminar visible arriba a la derecha en móvil */}
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    aria-label={`Eliminar código ${item.code}`}
                    className="md:hidden min-w-[44px] min-h-[44px] rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800/70 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Columna 2: Campo editable de Nombre / Nota por producto */}
                <div className="md:col-span-4">
                  <div className="relative">
                    <Tag className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) => onUpdateNote(item.id, e.target.value)}
                      placeholder="Añadir nombre o nota..."
                      aria-label={`Nota para el código ${item.code}`}
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors"
                    />
                  </div>
                </div>

                {/* Columna 3: Controles grandes de Cantidad (+ / -) */}
                <div className="md:col-span-3 flex items-center justify-between md:justify-center gap-2 pt-1 md:pt-0">
                  <span className="text-xs font-medium text-slate-400 md:hidden">
                    Cantidad:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      aria-label={`Restar unidad a ${item.code}`}
                      className="min-w-[46px] min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className="min-w-[48px] text-center font-mono text-lg font-bold text-white tabular-nums">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      aria-label={`Sumar unidad a ${item.code}`}
                      className="min-w-[46px] min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Columna 4: Eliminar fila en escritorio */}
                <div className="hidden md:flex md:col-span-1 justify-end">
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    aria-label={`Eliminar código ${item.code}`}
                    className="min-w-[44px] min-h-[44px] rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pie de tabla con recuento filtrado */}
          <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 tabular-nums">
            <span>
              Mostrando {filteredItems.length} de {totalUniqueProducts}{' '}
              {totalUniqueProducts === 1 ? 'producto' : 'productos'}
            </span>
            <span className="font-semibold text-slate-200">
              Subtotal: {filteredUnits} {filteredUnits === 1 ? 'unidad' : 'unidades'}
            </span>
          </div>
        </div>
      )}

      {/* Modal de confirmación para borrar toda la lista */}
      {confirmClearOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
            <h3 id="clear-modal-title" className="text-lg font-bold text-white">
              ¿Borrar toda la lista?
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Se eliminarán los {totalUniqueProducts} códigos registrados ({totalUnits}{' '}
              unidades en total) de este dispositivo. Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClearOpen(false);
                }}
                className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
