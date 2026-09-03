/**
 * Cliente Supabase
 */

import { createClient } from '@supabase/supabase-js';

export function criarClienteSupabase() {
  const url = process.env.SUPABASE_URL;
  // Aceita tanto SUPABASE_PAT quanto SUPABASE_SERVICE_ROLE_KEY
  const pat = process.env.SUPABASE_PAT || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !pat) {
    throw new Error('SUPABASE_URL e SUPABASE_PAT (ou SUPABASE_SERVICE_ROLE_KEY) são obrigatórios');
  }

  return createClient(url, pat, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
