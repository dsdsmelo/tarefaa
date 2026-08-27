import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

const PRICE_ID = "price_1TKlOs3ZSGU2dSgqFzAOEjJA";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-GUEST-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Verificação anti-bot (Cloudflare Turnstile) — server-side siteverify.
    // Só é exigida quando TURNSTILE_SECRET está configurado (evita quebrar
    // antes da configuração). Valida o token e o hostname de origem.
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET");
    if (turnstileSecret) {
      let captchaToken: string | undefined;
      try {
        const body = await req.json();
        captchaToken = body?.captchaToken;
      } catch {
        captchaToken = undefined;
      }
      if (!captchaToken) {
        logStep("Missing captcha token");
        return new Response(JSON.stringify({ error: "Verificação de segurança ausente." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }
      const form = new URLSearchParams({ secret: turnstileSecret, response: captchaToken });
      const ip = req.headers.get("CF-Connecting-IP");
      if (ip) form.set("remoteip", ip);
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const outcome = await verifyRes.json();
      const hostOk = !outcome.hostname || String(outcome.hostname).endsWith("tarefaa.com.br");
      if (!outcome.success || !hostOk) {
        logStep("Captcha verification failed", { errors: outcome["error-codes"], hostname: outcome.hostname });
        return new Response(JSON.stringify({ error: "Falha na verificação de segurança." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
        });
      }
      logStep("Captcha verified", { hostname: outcome.hostname });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://tarefaa.com.br";
    logStep("Origin", { origin });

    // Create checkout session without requiring authentication
    // For subscription mode, customer is created automatically
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "subscription",
      phone_number_collection: {
        enabled: true,
      },
      billing_address_collection: "required",
      success_url: `${origin}/login?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?subscription=cancelled`,
      allow_promotion_codes: true,
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
