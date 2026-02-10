import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabaseClient.ts:7',message:'Supabase client creation attempt',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseAnonKey,urlPrefix:supabaseUrl?.substring(0,20)},timestamp:Date.now(),hypothesisId:'H1',runId:'initial'})}).catch(()=>{});
  // #endregion

  if (!supabaseUrl || !supabaseAnonKey) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabaseClient.ts:12',message:'Missing env vars',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseAnonKey},timestamp:Date.now(),hypothesisId:'H1',runId:'initial'})}).catch(()=>{});
    // #endregion
    throw new Error('Supabase environment variables are not set');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

