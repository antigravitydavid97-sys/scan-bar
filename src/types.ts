/**
 * Modelo de datos para cada producto o código escaneado.
 */
export interface ScannedItem {
  /** Identificador único interno */
  id: string;
  /** Valor del código de barras o QR leído */
  code: string;
  /** Formato detectado (ej. EAN-13, CODE-128, QR, Manual) */
  format: string;
  /** Nombre opcional o nota asignada al producto */
  note: string;
  /** Cantidad acumulada de unidades */
  quantity: number;
  /** Fecha y hora del último escaneo en milisegundos (Epoch) */
  updatedAt: number;
  /** Fecha y hora del primer escaneo en milisegundos (Epoch) */
  createdAt: number;
}

export type ActiveScreen = 'scanner' | 'list';
