import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

// Helper logging function for debugging
const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logStep("No auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    logStep("Auth header found");

    // Create Supabase client with auth header
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate JWT using getUser
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      logStep("JWT validation failed", { error: userError?.message });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = user.id;
    logStep("User authenticated", { userId });

    // Get subscription using admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: subscription, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // If no subscription found, that's okay - user just doesn't have one yet
    if (error && error.code !== "PGRST116") {
      logStep("Error fetching subscription", { error: error.message });
      throw new Error("Failed to fetch subscription");
    }

    // If subscription exists but period dates are missing, sync from Stripe
    if (subscription?.stripe_subscription_id && (!subscription.current_period_start || !subscription.current_period_end)) {
      try {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeKey) {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
          const periodStart = stripeSub.current_period_start
            ? new Date(stripeSub.current_period_start * 1000).toISOString()
            : null;
          const periodEnd = stripeSub.current_period_end
            ? new Date(stripeSub.current_period_end * 1000).toISOString()
            : null;

          await supabaseAdmin
            .from("subscriptions")
            .update({
              current_period_start: periodStart,
              current_period_end: periodEnd,
              status: stripeSub.status,
              cancel_at_period_end: stripeSub.cancel_at_period_end,
            })
            .eq("user_id", userId);

          // Update local object for response
          subscription.current_period_start = periodStart;
          subscription.current_period_end = periodEnd;
          subscription.status = stripeSub.status;
          subscription.cancel_at_period_end = stripeSub.cancel_at_period_end;
          logStep("Synced period dates from Stripe");
        }
      } catch (syncError) {
        logStep("Could not sync from Stripe (non-fatal)", { error: String(syncError) });
      }
    }

    logStep("Subscription fetched", { hasSubscription: !!subscription, status: subscription?.status });

    // Check if user has admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!roleData;
    const hasActiveSubscription = ["active", "trialing"].includes(subscription?.status || "");

    // Convidado (participante): tem vínculo em people.auth_user_id.
    // Não precisa de assinatura própria — o acesso dele é escopo do projeto.
    const { data: participantPerson } = await supabaseAdmin
      .from("people")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const isParticipant = !!participantPerson;

    logStep("Access check complete", { isAdmin, hasActiveSubscription, isParticipant });

    return new Response(
      JSON.stringify({
        subscription,
        isAdmin,
        isParticipant,
        hasAccess: hasActiveSubscription || isAdmin || isParticipant,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
