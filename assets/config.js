/* Soberana Member Portal — public configuration.
   The anon key is public by design (C-003 §1): it grants nothing beyond what
   RLS policies allow. The service_role key never belongs in this file. */

export const SUPABASE_URL = 'PEGA_AQUI_EL_PROJECT_URL';
export const SUPABASE_ANON_KEY = 'PEGA_AQUI_LA_ANON_KEY';

export const CONFIGURED =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 100 &&
  !SUPABASE_ANON_KEY.startsWith('PEGA_AQUI');
