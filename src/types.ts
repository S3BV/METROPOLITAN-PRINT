export interface Floor {
  id: string;
  p: number;
  yellow?: boolean;
}

export interface Printer {
  id?: number;
  hh: string;
  serie: string | null;
  marca: string;
  modelo: string;
  ip: string;
  piso: string;
  area: string;
  tipo: string;
  estado: string;
  checklist?: Record<string, boolean>;
  created_at?: string;
}

export interface PEstado {
  color: string;
  bg: string;
}

export interface ModeloCatalogo {
  id?: number;
  marca: string;
  modelo: string;
  tipo_defecto?: string | null;
}

export type FloorZone = 'low' | 'high' | 'rect';
export type FloorState = 'normal' | 'hov' | 'sel';