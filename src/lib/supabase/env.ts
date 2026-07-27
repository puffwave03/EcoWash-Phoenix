const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
