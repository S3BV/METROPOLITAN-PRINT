import { createClient } from '@supabase/supabase-js';
import type { Printer, ModeloCatalogo } from './types';

export const db = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_KEY as string,
);

export async function loadPrinters(): Promise<Printer[]> {
  const { data, error } = await db.from('impresoras').select('*').order('created_at');
  if (error) { console.error('Supabase load error:', error); return []; }
  return (data ?? []) as Printer[];
}

export async function loadModelos(): Promise<ModeloCatalogo[]> {
  const { data, error } = await db.from('modelos').select('*').order('marca').order('modelo');
  if (error) { console.error('Supabase modelos error:', error); return []; }
  return (data ?? []) as ModeloCatalogo[];
}