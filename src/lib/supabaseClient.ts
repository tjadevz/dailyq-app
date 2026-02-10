import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // #region agent log
  let urlHost = 'none';
  try { urlHost = supabaseUrl ? new URL(supabaseUrl).host : 'none'; } catch {}
  fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabaseClient.ts:7',message:'Supabase client creation attempt',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseAnonKey,urlPrefix:supabaseUrl?.substring(0,30),urlHost,nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),hypothesisId:'H_CONFIG',runId:'initial'})}).catch(()=>{});
  // #endregion

  if (!supabaseUrl || !supabaseAnonKey) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabaseClient.ts:12',message:'Missing env vars ERROR',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseAnonKey,allEnvKeys:Object.keys(process.env).filter(k=>k.includes('SUPABASE'))},timestamp:Date.now(),hypothesisId:'H_CONFIG',runId:'initial'})}).catch(()=>{});
    // #endregion
    throw new Error('Supabase environment variables are not set');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

