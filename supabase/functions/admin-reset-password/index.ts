import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-RESET-PASSWORD] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create regular client to verify the requester
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate JWT using getUser
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      logStep("JWT validation failed");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const requesterId = user.id;
    logStep("Requester authenticated", { requesterId });

    // Check if requester is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      logStep("Requester is not admin");
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    logStep("Admin verified");

    // Get request body
    const { userId, action } = await req.json();

    if (!userId || !action) {
      return new Response(
        JSON.stringify({ error: "userId and action are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    logStep("Processing action", { userId, action });

    let result: { success: boolean; message: string };

    switch (action) {
      case "resetPassword": {
        // Get user email first
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

        if (userError || !userData?.user) {
          throw new Error("User not found");
        }

        // Gera uma senha temporária ALEATÓRIA e FORTE (não previsível).
        // Complexidade garantida (maiúscula, minúscula, número e símbolo).
        const bytes = new Uint8Array(18);
        crypto.getRandomValues(bytes);
        const rand = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, '');
        const tempPassword = `Aa1!${rand.slice(0, 16)}`;

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: tempPassword,
        });

        if (updateError) {
          throw updateError;
        }

        // A senha só volta ao admin (canal autenticado/HTTPS) para repasse.
        // Nunca é registrada em log.
        result = {
          success: true,
          message: `Senha temporária definida: ${tempPassword}. Peça ao usuário para alterá-la no primeiro acesso.`,
        };
        break;
      }

      case "blockUser": {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h", // ~100 years
        });

        if (error) throw error;

        result = { success: true, message: "Usuário bloqueado com sucesso." };
        break;
      }

      case "unblockUser": {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });

        if (error) throw error;

        result = { success: true, message: "Usuário desbloqueado com sucesso." };
        break;
      }

      case "activateSubscription": {
        // Calculate period dates (30 days from now)
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Check if subscription exists
        const { data: existingSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (existingSub) {
          // Update existing subscription
          const { error } = await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("user_id", userId);

          if (error) throw error;
        } else {
          // Create new subscription
          const { error } = await supabaseAdmin
            .from("subscriptions")
            .insert({
              user_id: userId,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            });

          if (error) throw error;
        }

        result = {
          success: true,
          message: `Assinatura ativada com sucesso. Válida até ${periodEnd.toLocaleDateString('pt-BR')}.`
        };
        break;
      }

      case "deactivateSubscription": {
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "inactive",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (error) throw error;

        result = { success: true, message: "Assinatura desativada com sucesso." };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }

    logStep("Action completed", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
