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
  console.log(`[MANAGE-SUB] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json();
    const { action, customerId, subscriptionId, priceId } = body;
    logStep("Action requested", { action, customerId, subscriptionId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "http://localhost:3000";

    let result: Record<string, unknown> = {};

    switch (action) {
      case "create-setup-intent": {
        // Create SetupIntent for updating payment method
        const setupIntent = await stripe.setupIntents.create({
          customer: customerId,
          payment_method_types: ["card"],
        });
        result = { clientSecret: setupIntent.client_secret };
        logStep("SetupIntent created");
        break;
      }

      case "update-default-payment": {
        // Update the default payment method on the subscription
        const { paymentMethodId } = body;
        if (!paymentMethodId || !subscriptionId) throw new Error("Missing paymentMethodId or subscriptionId");
        await stripe.subscriptions.update(subscriptionId, {
          default_payment_method: paymentMethodId,
        });
        result = { success: true };
        logStep("Default payment method updated");
        break;
      }

      case "cancel-subscription": {
        if (!subscriptionId) throw new Error("Missing subscriptionId");
        // Cancel at end of billing period
        const updated = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        result = {
          success: true,
          cancelAt: new Date(updated.current_period_end * 1000).toISOString(),
        };
        logStep("Subscription set to cancel at period end");
        break;
      }

      case "reactivate-subscription": {
        if (!subscriptionId) throw new Error("Missing subscriptionId");
        const reactivated = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
        });
        result = { success: true, status: reactivated.status };
        logStep("Subscription reactivated");
        break;
      }

      case "change-plan": {
        if (!subscriptionId || !priceId) throw new Error("Missing subscriptionId or priceId");
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const updated = await stripe.subscriptions.update(subscriptionId, {
          items: [{
            id: sub.items.data[0].id,
            price: priceId,
          }],
          proration_behavior: "create_prorations",
        });
        result = {
          success: true,
          newPriceId: updated.items.data[0].price.id,
        };
        logStep("Plan changed", { newPriceId: result.newPriceId });
        break;
      }

      case "create-update-payment-session": {
        // Use Stripe's checkout in setup mode as a simple way to update payment
        if (!customerId) throw new Error("Missing customerId");
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "setup",
          payment_method_types: ["card"],
          success_url: `${origin}/subscription?updated=true`,
          cancel_url: `${origin}/subscription`,
        });
        result = { url: session.url };
        logStep("Setup checkout session created");
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
