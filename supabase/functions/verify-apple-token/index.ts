// supabase/functions/verify-apple-token/index.ts
// Stub: accepts Apple identity token, returns Supabase session tokens.
// TODO: Verify JWT with Apple's JWKS, create/link user in Supabase Auth, return real access_token + refresh_token.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: { identityToken?: string; user?: string; fullName?: { givenName?: string; familyName?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const identityToken = body?.identityToken;
  if (!identityToken || typeof identityToken !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing identityToken" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Stub: do not verify the token or create a session yet.
  // Real implementation will: verify with Apple JWKS, create/link user in Supabase Auth, return session tokens.
  return new Response(
    JSON.stringify({
      error: "verify-apple-token not implemented",
    }),
    {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
