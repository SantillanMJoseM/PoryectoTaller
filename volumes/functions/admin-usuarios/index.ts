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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const action = String(body?.action ?? "crearCredencial");

    // Verificar autorización: service role o admin con permiso aUsuario.
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let autorizado = token === serviceKey;
    if (!autorizado && token) {
      const { data: u } = await admin.auth.getUser(token);
      const perms = (u?.user?.app_metadata?.permisos ?? []) as string[];
      if (perms.includes("aUsuario")) autorizado = true;
    }
    if (!autorizado) {
      return new Response(JSON.stringify({ error: "No autorizado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bootstrap" || action === "crearCredencial") {
      const correo = String(body?.correo ?? "").trim();
      const contrasena = String(body?.contrasena ?? "");
      if (!correo || !contrasena) {
        return new Response(JSON.stringify({ error: "Faltan credenciales." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar usuario existente.
      const { data: list } = await admin.auth.admin.listUsers();
      let authUser = (list?.users ?? []).find((u: any) => u.email === correo);

      if (!authUser) {
        const createOpts: any = {
          email: correo,
          password: contrasena,
          email_confirm: true,
          app_metadata: {
            rol: "administrador",
            must_change_password: true,
            permisos: [],
          },
        };
        if (body?.usuario_id) createOpts.id = body.usuario_id;
        const { data: created, error: errCreate } = await admin.auth.admin.createUser(createOpts);
        if (errCreate || !created?.user) {
          return new Response(JSON.stringify({ error: errCreate?.message ?? "No se pudo crear la identidad." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        authUser = created.user;
      }

      // Obtener grupo Administrador.
      const { data: grupo } = await admin
        .from("permisos")
        .select("id_permiso, permisos")
        .eq("nombre", "Administrador")
        .maybeSingle();

      const permisos = Array.isArray(grupo?.permisos) ? grupo.permisos : [];

      // Actualizar app_metadata.
      await admin.auth.admin.updateUserById(authUser.id, {
        app_metadata: {
          rol: "administrador",
          usuario_id: authUser.id,
          permisos,
          must_change_password: true,
        },
      });

      // Vincular perfil (idempotente por correo).
      const { data: perfilExistente } = await admin
        .from("usuarios")
        .select("id_usuario")
        .eq("correo", correo)
        .maybeSingle();
      if (perfilExistente) {
        await admin.from("usuarios").update({
          id_usuario: authUser.id,
          nombre: body?.nombre ?? "Administrador",
          estado_usuario: true,
          permiso_id: grupo?.id_permiso ?? null,
          debe_cambiar_contrasena: true,
        }).eq("correo", correo);
      } else {
        await admin.from("usuarios").insert({
          id_usuario: authUser.id,
          nombre: body?.nombre ?? "Administrador",
          correo,
          estado_usuario: true,
          permiso_id: grupo?.id_permiso ?? null,
          debe_cambiar_contrasena: true,
        });
      }

      return new Response(JSON.stringify({ ok: true, id: authUser.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acción no soportada." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
