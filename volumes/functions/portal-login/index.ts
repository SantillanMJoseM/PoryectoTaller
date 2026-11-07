import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { correo, documento } = await req.json();
    const c = String(correo ?? "").trim();
    const d = String(documento ?? "").trim();
    if (!c || !d) {
      return new Response(JSON.stringify({ error: "Faltan credenciales." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalPassword = Deno.env.get("PORTAL_CLIENT_PASSWORD") ?? "REDACTED";

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: cliente, error: errCliente } = await admin
      .from("clientes")
      .select("id_cliente, nombre_cliente, correo, documento")
      .ilike("correo", c)
      .eq("documento", d)
      .maybeSingle();

    if (errCliente || !cliente) {
      return new Response(JSON.stringify({ error: "Los datos no coinciden con un cliente registrado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const internalEmail = `portal-${cliente.id_cliente}@sistema-taller.local`;

    // Intentar iniciar sesión; si el usuario no existe, crearlo.
    let signIn = await admin.auth.signInWithPassword({
      email: internalEmail,
      password: internalPassword,
    });

    if (signIn.error) {
      const created = await admin.auth.admin.createUser({
        email: internalEmail,
        password: internalPassword,
        email_confirm: true,
        app_metadata: {
          rol: "cliente",
          cliente_id: cliente.id_cliente,
        },
      });
      if (created.error) {
        return new Response(JSON.stringify({ error: created.error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      signIn = await admin.auth.signInWithPassword({
        email: internalEmail,
        password: internalPassword,
      });
    }

    if (signIn.error || !signIn.data.session) {
      return new Response(JSON.stringify({ error: signIn.error?.message ?? "No se pudo crear la sesión." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        session: {
          access_token: signIn.data.session.access_token,
          refresh_token: signIn.data.session.refresh_token,
        },
        cliente: {
          id_cliente: cliente.id_cliente,
          nombre_cliente: cliente.nombre_cliente,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
