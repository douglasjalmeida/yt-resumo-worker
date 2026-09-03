/**
 * Cliente Supabase
 */

import { createClient } from '@supabase/supabase-js';

export function criarClienteSupabase() {
  const url = process.env.SUPABASE_URL;
  const pat = process.env.SUPABASE_PAT;

  if (!url || !pat) {
    throw new Error('SUPABASE_URL e SUPABASE_PAT são obrigatórios');
  }

  return createClient(url, pat, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
