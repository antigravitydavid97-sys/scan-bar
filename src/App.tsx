import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScanBarcode, ListOrdered, FileSpreadsheet } from 'lucide-react';
import { ActiveScreen, ScannedItem } from './types';
import { ScannerView } from './components/ScannerView';
import { ListView } from './components/ListView';
import { triggerScanFeedback } from './utils/feedback';
import { exportToExcel } from './utils/export';

const STORAGE_KEY = 'lector_codigos_inventario_v1';
const SOUND_PREF_KEY = 'lector_codigos_sonido_v1';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('scanner');

  // Cargar lista de códigos desde localStorage al iniciar
  const [items, setItems] = useState<ScannedItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Preferencia de sonido ("beep")
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SOUND_PREF_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Guardar referencia al último ítem escaneado para mostrarlo en la tarjeta del escáner
  const [lastScannedId, setLastScannedId] = useState<string | null>(() => {
    return items.length > 0 ? items[0].id : null;
  });

  // Persistir automáticamente cada cambio en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignorar si el almacenamiento local está lleno
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_PREF_KEY, JSON.stringify(soundEnabled));
    } catch {
      // Ignorar
    }
  }, [soundEnabled]);

  /**
   * Registra un código escaneado o introducido manualmente.
   * Si el código ya existe, suma la cantidad (por defecto +1) en lugar de duplicar la fila.
   */
  const handleScanCode = useCallback(
    (
      rawCode: string,
      format: string,
      customNote?: string,
      customQty = 1
    ): ScannedItem => {
      const code = rawCode.trim();
      const now = Date.now();
      let resultingItem: ScannedItem | null = null;

      // Disparar vibración y sonido "beep"
      triggerScanFeedback(soundEnabled);

      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex(
          (item) => item.code.toLowerCase() === code.toLowerCase()
        );

        if (existingIndex !== -1) {
          const existing = prevItems[existingIndex];
          const updated: ScannedItem = {
            ...existing,
            quantity: existing.quantity + customQty,
            note:
              customNote && customNote.trim().length > 0
                ? customNote.trim()
                : existing.note,
            updatedAt: now,
          };
          resultingItem = updated;
          setLastScannedId(updated.id);

          // Mover el producto recién actualizado al principio de la lista
          const nextList = [...prevItems];
          nextList.splice(existingIndex, 1);
          return [updated, ...nextList];
        } else {
          const newItem: ScannedItem = {
            id: `${now}-${Math.random().toString(36).substring(2, 8)}`,
            code,
            format,
            note: customNote ? customNote.trim() : '',
            quantity: Math.max(1, customQty),
            createdAt: now,
            updatedAt: now,
          };
          resultingItem = newItem;
          setLastScannedId(newItem.id);
          return [newItem, ...prevItems];
        }
      });

      return (
        resultingItem || {
          id: String(now),
          code,
          format,
          note: customNote || '',
          quantity: customQty,
          createdAt: now,
          updatedAt: now,
        }
      );
    },
    [soundEnabled]
  );

  /**
   * Suma o resta unidades a un código existente (+ / -).
   * Si la cantidad baja a 0, se elimina el registro.
   */
  const handleUpdateQuantity = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...item,
            quantity: nextQty,
            updatedAt: Date.now(),
          };
        })
        .filter((item): item is ScannedItem => item !== null)
    );
  }, []);

  /**
   * Asigna una cantidad exacta
   */
  const handleSetQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity, updatedAt: Date.now() } : item
      )
    );
  }, []);

  /**
   * Actualiza el nombre o nota opcional de un producto
   */
  const handleUpdateNote = useCallback((id: string, note: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, note } : item))
    );
  }, []);

  /**
   * Elimina un único código de la lista
   */
  const handleDeleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Vacía toda la lista tras confirmación del usuario
   */
  const handleClearAll = useCallback(() => {
    setItems([]);
    setLastScannedId(null);
  }, []);

  const lastScannedItem = useMemo(
    () => items.find((i) => i.id === lastScannedId) || items[0] || null,
    [items, lastScannedId]
  );

  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Cabecera Superior (Cumple Top Bar Contract: 3 zonas limpias) */}
      <header className="sticky top-0 z-30 h-14 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zona 1: Marca única en una línea */}
        <a
          href="#escaner"
          onClick={(e) => {
            e.preventDefault();
            setActiveScreen('scanner');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Lector de Códigos
        </a>

        {/* Zona 2: Enlaces de navegación en escritorio */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={() => setActiveScreen('scanner')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeScreen === 'scanner' ? 'text-white underline underline-offset-8 decoration-[#2563EB] decoration-2' : ''
            }`}
          >
            Escáner
          </button>
          <button
            type="button"
            onClick={() => setActiveScreen('list')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeScreen === 'list' ? 'text-white underline underline-offset-8 decoration-[#2563EB] decoration-2' : ''
            }`}
          >
            Lista ({totalUnits})
          </button>
        </nav>

        {/* Zona 3: 1 Acción Primaria (Exportar Excel directo) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => exportToExcel(items)}
            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col">
        {activeScreen === 'scanner' ? (
          <ScannerView
            onScanCode={handleScanCode}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateNote={handleUpdateNote}
            lastScannedItem={lastScannedItem}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled((prev) => !prev)}
            totalUnits={totalUnits}
            onGoToList={() => setActiveScreen('list')}
          />
        ) : (
          <ListView
            items={items}
            onUpdateQuantity={handleUpdateQuantity}
            onSetQuantity={handleSetQuantity}
            onUpdateNote={handleUpdateNote}
            onDeleteItem={handleDeleteItem}
            onClearAll={handleClearAll}
            onGoToScanner={() => setActiveScreen('scanner')}
          />
        )}
      </main>

      {/* Barra de Navegación Inferior Fija (Escáner / Lista) pensada para manejo con una mano */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 grid grid-cols-2 items-center px-4"
      >
        <button
          type="button"
          onClick={() => setActiveScreen('scanner')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
            activeScreen === 'scanner'
              ? 'text-[#2563EB]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ScanBarcode className="w-5 h-5" />
          <span className="text-[11px] font-semibold tracking-tight mt-1 whitespace-nowrap">
            Escáner
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveScreen('list')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
            activeScreen === 'list'
              ? 'text-[#2563EB]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <ListOrdered className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold tracking-tight mt-1 whitespace-nowrap tabular-nums">
            Lista ({totalUnits})
          </span>
        </button>
      </nav>
    </div>
  );
}
