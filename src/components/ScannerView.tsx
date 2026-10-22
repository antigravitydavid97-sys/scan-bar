import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Flashlight,
  Keyboard,
  Plus,
  Minus,
  Volume2,
  VolumeX,
  RefreshCw,
  Check,
  AlertCircle,
  X,
  Tag,
} from 'lucide-react';
import { ScannedItem } from '../types';

interface ScannerViewProps {
  onScanCode: (code: string, format: string, customNote?: string, customQty?: number) => ScannedItem;
  onUpdateQuantity: (id: string, delta: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  lastScannedItem: ScannedItem | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
  totalUnits: number;
  onGoToList: () => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

/**
 * Normaliza el nombre del formato devuelto por html5-qrcode
 */
function normalizeFormatName(rawFormat?: string): string {
  if (!rawFormat) return 'CÓDIGO';
  return rawFormat.replace(/_/g, '-').toUpperCase();
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  onScanCode,
  onUpdateQuantity,
  onUpdateNote,
  lastScannedItem,
  soundEnabled,
  onToggleSound,
  totalUnits,
  onGoToList,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const lastScanLockRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'denied' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanFlash, setScanFlash] = useState<boolean>(false);

  // Estado para modal de entrada manual
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [manualNote, setManualNote] = useState<string>('');
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualError, setManualError] = useState<string>('');

  // Detener escáner de forma segura
  const stopScanner = useCallback(async () => {
    const instance = scannerRef.current;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // Ignorar errores al desmontar
    } finally {
      scannerRef.current = null;
      setTorchOn(false);
      setTorchSupported(false);
    }
  }, []);

  // Iniciar la cámara y el lector en tiempo real
  const startScanner = useCallback(async () => {
    await stopScanner();
    if (!isMountedRef.current) return;

    setCameraState('starting');
    setErrorMessage('');

    try {
      const html5QrCode = new Html5Qrcode('barcode-reader-viewport', {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode },
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.82), 360);
            const height = Math.min(Math.floor(viewfinderHeight * 0.45), 200);
            return {
              width: Math.max(width, 200),
              height: Math.max(height, 120),
            };
          },
          aspectRatio: 1.333334,
        },
        (decodedText, decodedResult) => {
          const cleanCode = decodedText.trim();
          if (!cleanCode) return;

          const now = Date.now();
          // Pausa de 1.35 segundos para el mismo código para evitar sumas involuntarias múltiples en ráfaga
          if (
            lastScanLockRef.current.code === cleanCode &&
            now - lastScanLockRef.current.time < 1350
          ) {
            return;
          }

          lastScanLockRef.current = { code: cleanCode, time: now };
          const formatName = normalizeFormatName(decodedResult?.result?.format?.formatName);

          onScanCode(cleanCode, formatName);
          setScanFlash(true);
          window.setTimeout(() => {
            if (isMountedRef.current) setScanFlash(false);
          }, 260);
        },
        () => {
          // Errores por fotograma sin código visible se ignoran
        }
      );

      if (!isMountedRef.current) {
        await stopScanner();
        return;
      }

      setCameraState('active');

      // Comprobar soporte de linterna (torch) en el dispositivo móvil
      try {
        const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
        if (capabilities && capabilities.torchFeature && capabilities.torchFeature().isSupported()) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } catch {
        setTorchSupported(false);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const rawError = err instanceof Error ? err.message : String(err);
      const isPermissionDenied =
        rawError.toLowerCase().includes('permission') ||
        rawError.toLowerCase().includes('notallowed') ||
        rawError.toLowerCase().includes('denied');

      if (isPermissionDenied) {
        setCameraState('denied');
        setErrorMessage(
          'Se ha denegado el permiso de cámara. Activa el acceso a la cámara en los ajustes de tu navegador (Chrome o Safari) o introduce el código manualmente.'
        );
      } else {
        setCameraState('error');
        setErrorMessage(
          'No se pudo acceder a la cámara del dispositivo. Comprueba que estés en HTTPS, que ninguna otra app esté usando la cámara o usa la entrada manual.'
        );
      }
    }
  }, [facingMode, onScanCode, stopScanner]);

  useEffect(() => {
    isMountedRef.current = true;
    startScanner();

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  // Encender / apagar linterna
  const handleToggleTorch = async () => {
    const instance = scannerRef.current;
    if (!instance || !torchSupported) return;
    try {
      const nextState = !torchOn;
      const capabilities = instance.getRunningTrackCameraCapabilities();
      if (capabilities && capabilities.torchFeature) {
        await capabilities.torchFeature().apply(nextState);
        setTorchOn(nextState);
      }
    } catch {
      // Algunos navegadores reportan soporte pero fallan al conmutar
    }
  };

  // Alternar entre cámara trasera y frontal
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Guardar código manual
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) {
      setManualError('Introduce un código válido.');
      return;
    }

    onScanCode(trimmed, 'MANUAL', manualNote.trim(), manualQty);
    setManualCode('');
    setManualNote('');
    setManualQty(1);
    setManualError('');
    setIsManualModalOpen(false);
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-5 w-full max-w-6xl mx-auto px-4 pt-3 pb-24">
      {/* Columna principal: Visor de cámara a pantalla completa en móvil */}
      <div className="lg:col-span-7 flex flex-col">
        <div className="relative w-full h-[54vh] min-h-[340px] max-h-[520px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center">
          {/* Contenedor donde html5-qrcode inyecta el elemento <video> */}
          <div id="barcode-reader-viewport" className="w-full h-full object-cover" />

          {/* Destello visual al detectar un código */}
          {scanFlash && (
            <div
              className="absolute inset-0 bg-[#2563EB]/35 pointer-events-none transition-opacity duration-200 z-20"
              aria-hidden="true"
            />
          )}

          {/* Marco guía superpuesto cuando la cámara está activa */}
          {cameraState === 'active' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 p-6">
              {/* Indicador superior de formatos soportados */}
              <div className="absolute top-3.5 left-4 right-4 flex items-center justify-between text-xs text-slate-300 bg-slate-950/75 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800/80">
                <span className="font-medium text-slate-200 truncate">
                  Apunta al código de barras o QR
                </span>
                <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                  EAN · UPC · CODE 128/39 · QR
                </span>
              </div>

              {/* Retícula / Marco guía con esquinas en azul #2563EB */}
              <div className="relative w-full max-w-[300px] h-[165px] rounded-2xl flex items-center justify-center">
                {/* Esquina superior izquierda */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#2563EB] rounded-tl-xl" />
                {/* Esquina superior derecha */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#2563EB] rounded-tr-xl" />
                {/* Esquina inferior izquierda */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#2563EB] rounded-bl-xl" />
                {/* Esquina inferior derecha */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#2563EB] rounded-br-xl" />

                {/* Línea láser animada */}
                <div className="w-[88%] h-0.5 bg-[#2563EB] shadow-[0_0_12px_#2563EB] animate-scanline rounded-full" />
              </div>

              {/* Barra flotante de controles rápidos de cámara (Linterna, Sonido, Cambiar Cámara) */}
              <div className="absolute bottom-3.5 left-4 right-4 flex items-center justify-between gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  disabled={!torchSupported}
                  title={
                    torchSupported
                      ? 'Encender o apagar linterna'
                      : 'Linterna no disponible en esta cámara/navegador'
                  }
                  className={`min-h-[46px] px-4 rounded-xl font-medium text-xs flex items-center gap-2 transition-colors backdrop-blur-md border ${
                    torchOn
                      ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-lg'
                      : torchSupported
                      ? 'bg-slate-900/85 text-slate-100 border-slate-700 hover:bg-slate-800'
                      : 'bg-slate-900/60 text-slate-500 border-slate-800/80 cursor-not-allowed'
                  }`}
                >
                  <Flashlight className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">
                    {torchSupported ? (torchOn ? 'Linterna activa' : 'Linterna') : 'Sin linterna'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleSound}
                    aria-label={soundEnabled ? 'Silenciar pitido' : 'Activar pitido'}
                    className="min-h-[46px] min-w-[46px] px-3 rounded-xl bg-slate-900/85 text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors backdrop-blur-md flex items-center justify-center"
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-[#2563EB]" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    aria-label="Cambiar cámara"
                    className="min-h-[46px] min-w-[46px] px-3 rounded-xl bg-slate-900/85 text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors backdrop-blur-md flex items-center justify-center"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Estado: Iniciando cámara */}
          {cameraState === 'starting' && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/15 border border-[#2563EB]/40 flex items-center justify-center mb-3">
                <Camera className="w-6 h-6 text-[#2563EB] animate-pulse" />
              </div>
              <p className="text-base font-semibold text-slate-100">Iniciando cámara trasera…</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Acepta el permiso de cámara de tu navegador para escanear códigos en tiempo real.
              </p>
            </div>
          )}

          {/* Estado: Permiso denegado o error de cámara */}
          {(cameraState === 'denied' || cameraState === 'error') && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3">
                <CameraOff className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-base font-bold text-slate-100">
                {cameraState === 'denied' ? 'Permiso de cámara denegado' : 'Cámara no disponible'}
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">
                {errorMessage}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={startScanner}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reintentar cámara</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Keyboard className="w-4 h-4" />
                  <span>Entrada manual</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Columna lateral / inferior: Último código detectado + Botón grande de entrada manual */}
      <div className="lg:col-span-5 flex flex-col justify-between gap-4">
        {/* Tarjeta del último resultado escaneado */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-400">
              Última lectura registrada
            </span>
            {lastScannedItem && (
              <span className="text-xs text-slate-400 tabular-nums">
                Formato {lastScannedItem.format}
              </span>
            )}
          </div>

          {lastScannedItem ? (
            <div className="space-y-4">
              {/* Código y control rápido de cantidad (+ / -) con una mano */}
              <div className="flex items-center justify-between gap-3 bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium mb-0.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Código guardado</span>
                  </div>
                  <p className="font-mono text-lg sm:text-xl font-bold text-white tracking-tight truncate tabular-nums">
                    {lastScannedItem.code}
                  </p>
                </div>

                {/* Controles grandes + / - para el pulgar */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(lastScannedItem.id, -1)}
                    aria-label="Restar 1 unidad"
                    className="min-w-[46px] min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="min-w-[44px] text-center">
                    <span className="font-mono text-lg font-bold text-white tabular-nums">
                      {lastScannedItem.quantity}
                    </span>
                    <span className="block text-[10px] text-slate-400">uds.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(lastScannedItem.id, 1)}
                    aria-label="Sumar 1 unidad"
                    className="min-w-[46px] min-h-[46px] rounded-xl bg-[#2563EB] hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Campo opcional de nombre o nota directa del producto recién escaneado */}
              <div>
                <label
                  htmlFor="last-scanned-note"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Nombre del producto o nota (opcional)
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="last-scanned-note"
                    type="text"
                    value={lastScannedItem.note}
                    onChange={(e) => onUpdateNote(lastScannedItem.id, e.target.value)}
                    placeholder="Ej. Caja leche entera 1L, Estante B4..."
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB] transition-colors"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-slate-300">
                Todavía no has escaneado ningún código en esta sesión
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Enfoca cualquier código de barras dentro del recuadro azul o pulsa «Entrada manual».
              </p>
            </div>
          )}
        </div>

        {/* Botones de acción principales al alcance de una mano */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => {
              setManualError('');
              setIsManualModalOpen(true);
            }}
            className="w-full min-h-[52px] px-5 py-3.5 rounded-2xl bg-[#2563EB] hover:bg-blue-500 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#2563EB]/20 transition-all cursor-pointer"
          >
            <Keyboard className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">Entrada manual de código</span>
          </button>

          <button
            type="button"
            onClick={onGoToList}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-sm flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Ver lista de inventario</span>
            <span className="font-mono text-xs text-slate-300 tabular-nums">
              {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
            </span>
          </button>
        </div>
      </div>

      {/* Modal / Hoja inferior de Entrada Manual */}
      {isManualModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-entry-title"
        >
          <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 id="manual-entry-title" className="text-lg font-bold text-white">
                Entrada manual de código
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                aria-label="Cerrar ventana"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="manual-code-input"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Código de barras / SKU / QR *
                </label>
                <input
                  id="manual-code-input"
                  type="text"
                  autoFocus
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value);
                    if (manualError) setManualError('');
                  }}
                  placeholder="Ej. 8410076472151"
                  className="w-full min-h-[48px] px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                />
                {manualError && (
                  <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{manualError}</span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="manual-note-input"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Nombre o nota del producto (opcional)
                </label>
                <input
                  id="manual-note-input"
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Ej. Aceite de Oliva Virgen Extra 1L"
                  className="w-full min-h-[48px] px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-xs font-semibold text-slate-300">
                  Cantidad a añadir
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManualQty((q) => Math.max(1, q - 1))}
                    aria-label="Disminuir cantidad"
                    className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="min-w-[40px] text-center font-mono text-base font-bold text-white tabular-nums">
                    {manualQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setManualQty((q) => q + 1)}
                    aria-label="Aumentar cantidad"
                    className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Códigos rápidos de prueba por si se usa sin un producto físico a mano */}
              <div className="pt-1">
                <span className="block text-[11px] text-slate-400 mb-2">
                  Rellenar con ejemplo rápido:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManualCode('8410076472151');
                      setManualNote('Agua Mineral Natural 1.5L');
                      setManualError('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    EAN-13: 8410076472151
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualCode('ALM-2026-042');
                      setManualNote('Palé Cajas Embalaje A4');
                      setManualError('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    CODE-128: ALM-2026-042
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#2563EB] hover:bg-blue-500 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Guardar código
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
