import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

// Default price ID - update this when you change the price in Stripe
const DEFAULT_PRICE_ID = "price_1TKlOs3ZSGU2dSgqFzAOEjJA";

// Helper logging function for debugging
const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-STRIPE-PRICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    logStep("Stripe key verified");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Get price_id from request body or use default
    let priceId = DEFAULT_PRICE_ID;
    try {
      const body = await req.json();
      if (body?.price_id) {
        priceId = body.price_id;
      }
    } catch {
      // No body or invalid JSON, use default price
    }

    logStep("Fetching price", { priceId });

    // Fetch the price from Stripe
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product'],
    });

    logStep("Price retrieved", { 
      priceId: price.id, 
      amount: price.unit_amount,
      currency: price.currency 
    });

    // Extract product name
    const productName = typeof price.product === 'object' && price.product !== null 
      ? (price.product as Stripe.Product).name 
      : null;

    const response = {
      price_id: price.id,
      amount: price.unit_amount, // Amount in cents
      currency: price.currency,
      recurring: price.recurring ? {
        interval: price.recurring.interval,
        interval_count: price.recurring.interval_count,
      } : null,
      product_name: productName,
    };

    logStep("Returning price data", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR in get-stripe-price", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
