import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SYNC-STRIPE-TIER] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const { tierId, tierName, monthlyPrice, annualPrice } = await req.json();
    if (!tierId || !tierName) throw new Error("tierId and tierName are required");
    logStep("Syncing tier", { tierId, tierName, monthlyPrice });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get existing Stripe IDs from tier
    const { data: tier, error: tierErr } = await supabaseClient
      .from("subscription_tiers")
      .select("stripe_product_id, stripe_price_id")
      .eq("id", tierId)
      .single();
    if (tierErr) throw tierErr;

    let productId = tier?.stripe_product_id;
    let priceId = tier?.stripe_price_id;

    // Create or update Stripe product
    if (productId) {
      await stripe.products.update(productId, { name: tierName });
      logStep("Updated Stripe product", { productId });
    } else {
      const product = await stripe.products.create({
        name: tierName,
        metadata: { builderlynk_tier_id: tierId },
      });
      productId = product.id;
      logStep("Created Stripe product", { productId });
    }

    // Create new price if amount changed or no price exists
    const amountCents = Math.round((monthlyPrice || 0) * 100);

    if (amountCents > 0) {
      // Check if existing price matches
      let needNewPrice = !priceId;
      if (priceId) {
        try {
          const existingPrice = await stripe.prices.retrieve(priceId);
          if (existingPrice.unit_amount !== amountCents) {
            // Deactivate old price
            await stripe.prices.update(priceId, { active: false });
            needNewPrice = true;
            logStep("Deactivated old price", { priceId, oldAmount: existingPrice.unit_amount });
          }
        } catch {
          needNewPrice = true;
        }
      }

      if (needNewPrice) {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: amountCents,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { builderlynk_tier_id: tierId },
        });
        priceId = price.id;
        logStep("Created new Stripe price", { priceId, amount: amountCents });
      }
    }

    // Update tier with Stripe IDs
    const { error: updateErr } = await supabaseClient
      .from("subscription_tiers")
      .update({
        stripe_product_id: productId,
        stripe_price_id: priceId,
      })
      .eq("id", tierId);

    if (updateErr) throw updateErr;
    logStep("Updated tier with Stripe IDs", { productId, priceId });

    return new Response(
      JSON.stringify({ success: true, stripe_product_id: productId, stripe_price_id: priceId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
