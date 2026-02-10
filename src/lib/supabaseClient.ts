import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not set');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export async function signUpWithEmailAndPassword(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  return await supabase.auth.signUp({
    email,
    password,
  });
}

export async function signInWithEmailAndPassword(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

