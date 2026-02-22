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
  console.log(`[GET-SUB-DETAILS] ${step}${d}`);
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
    logStep("User authenticated", { userId: user.id });

    const { companyId } = await req.json().catch(() => ({}));

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find the Stripe customer for this company
    let stripeCustomerId: string | null = null;
    if (companyId) {
      const { data: company } = await supabaseClient
        .from("companies")
        .select("stripe_customer_id, name")
        .eq("id", companyId)
        .single();
      stripeCustomerId = company?.stripe_customer_id || null;
    }

    if (!stripeCustomerId) {
      // Fallback: look up by user email
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) stripeCustomerId = customers.data[0].id;
    }

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ hasSubscription: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found Stripe customer", { customerId: stripeCustomerId });

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 5,
      expand: ["data.default_payment_method"],
    });

    const activeSub = subscriptions.data.find(s => ["active", "trialing", "past_due"].includes(s.status));

    // Get invoices
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 20,
    });

    // Get payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });

    // Build response
    const subscription = activeSub ? {
      id: activeSub.id,
      status: activeSub.status,
      currentPeriodStart: new Date(activeSub.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(activeSub.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: activeSub.cancel_at_period_end,
      cancelAt: activeSub.cancel_at ? new Date(activeSub.cancel_at * 1000).toISOString() : null,
      planName: activeSub.items.data[0]?.price?.product
        ? (typeof activeSub.items.data[0].price.product === "string"
          ? activeSub.items.data[0].price.product
          : (activeSub.items.data[0].price.product as any).name)
        : "Unknown",
      planAmount: activeSub.items.data[0]?.price?.unit_amount || 0,
      planInterval: activeSub.items.data[0]?.price?.recurring?.interval || "month",
      priceId: activeSub.items.data[0]?.price?.id,
    } : null;

    // Resolve product name if needed
    if (subscription && typeof subscription.planName === "string" && subscription.planName.startsWith("prod_")) {
      try {
        const product = await stripe.products.retrieve(subscription.planName);
        subscription.planName = product.name;
      } catch { /* keep product id */ }
    }

    const invoiceList = invoices.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.amount_due,
      currency: inv.currency,
      date: new Date((inv.created || 0) * 1000).toISOString(),
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
    }));

    const cards = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand || "unknown",
      last4: pm.card?.last4 || "****",
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: activeSub?.default_payment_method
        ? (typeof activeSub.default_payment_method === "string"
          ? activeSub.default_payment_method === pm.id
          : (activeSub.default_payment_method as any).id === pm.id)
        : false,
    }));

    logStep("Data fetched", { hasSub: !!subscription, invoices: invoiceList.length, cards: cards.length });

    return new Response(JSON.stringify({
      hasSubscription: !!subscription,
      subscription,
      invoices: invoiceList,
      paymentMethods: cards,
      customerId: stripeCustomerId,
    }), {
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
