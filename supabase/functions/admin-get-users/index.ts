import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { fetchAllRows } from "../_shared/fetchAllRows.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Validate the user is an admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Use admin client for all queries (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Fetch all auth users (includes email, last_sign_in_at, etc.).
    // listUsers devolve 50 por padrão: pagina até a última página.
    const allAuthUsers = [];
    const AUTH_PER_PAGE = 1000;
    for (let page = 1; ; page++) {
      const { data, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: AUTH_PER_PAGE });
      if (authError) throw authError;
      const batch = data?.users ?? [];
      allAuthUsers.push(...batch);
      if (batch.length < AUTH_PER_PAGE) break;
    }
    const authUsers = { users: allAuthUsers };

    // Fetch all profiles, subscriptions and admin roles (paginado: 1000 linhas por requisição)
    // deno-lint-ignore no-explicit-any
    type Row = Record<string, any>;
    const [profiles, subscriptions, roles] = await Promise.all([
      fetchAllRows<Row>(() => supabaseAdmin.from("profiles").select("*", { count: "exact" }).order("id")),
      fetchAllRows<Row>(() => supabaseAdmin.from("subscriptions").select("*", { count: "exact" }).order("id")),
      fetchAllRows<Row>(() =>
        supabaseAdmin.from("user_roles").select("*", { count: "exact" }).eq("role", "admin").order("id")
      ),
    ]);

    const adminUserIds = new Set(roles?.map(r => r.user_id) || []);

    // Combine auth users with profiles and subscriptions
    const users = (authUsers?.users || []).map(authUser => {
      const profile = profiles?.find(p => p.id === authUser.id);
      const sub = subscriptions?.find(s => s.user_id === authUser.id);

      return {
        id: authUser.id,
        email: authUser.email,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null,
        subscription: sub ? {
          status: sub.status,
          current_period_end: sub.current_period_end,
          stripe_customer_id: sub.stripe_customer_id,
        } : null,
        is_admin: adminUserIds.has(authUser.id),
        is_blocked: !!authUser.banned_until,
      };
    });

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
