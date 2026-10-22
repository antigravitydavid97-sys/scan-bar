/**
 * Utilidades de retroalimentación sensorial (sonido "beep" de lector láser y vibración háptica).
 * Utiliza Web Audio API para no depender de archivos de audio externos y funcionar offline.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Ignorar si el navegador requiere interacción previa adicional
    });
  }
  return audioCtx;
}

/**
 * Reproduce un pitido ("beep") nítido estilo escáner de supermercado/almacén
 * y activa la vibración del dispositivo móvil si está soportada.
 */
export function triggerScanFeedback(soundEnabled = true): void {
  // 1. Vibración háptica en móviles compatibles (Android / navegadores compatibles)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([75]);
    }
  } catch {
    // Silenciar errores en dispositivos sin soporte de vibración (ej. iOS Safari)
  }

  // 2. Sonido "beep" sintetizado con Web Audio API
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Frecuencia típica de lector de código de barras comercial (~1850 Hz)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1850, now);
    oscillator.frequency.exponentialRampToValueAtTime(1920, now + 0.09);

    // Envolvente rápida sin clic al final
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.12);
  } catch {
    // Ignorar si el contexto de audio está bloqueado
  }
}
