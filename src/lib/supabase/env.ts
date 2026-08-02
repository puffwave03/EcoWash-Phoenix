const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(name: string, value: string | undefined) {
  if (!value?.trim()) {
    throw new Error(`${name} is required to initialize Supabase.`);
  }

  return value;
}

export function getSupabaseConfig() {
  return {
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY),
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
  };
}

export function getSupabaseAdminConfig() {
  return {
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
  };
}

export function hasSupabaseAdminConfig() {
  return Boolean(SUPABASE_SERVICE_ROLE_KEY?.trim() && SUPABASE_URL?.trim());
}
