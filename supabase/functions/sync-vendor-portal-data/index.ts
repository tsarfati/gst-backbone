import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const authed = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authed.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id, role, vendor_id, current_company_id")
      .eq("user_id", user.id)
      .single();
    if (profileError || !profile?.vendor_id || String(profile.role || "").toLowerCase() !== "vendor") {
      return new Response(JSON.stringify({ error: "Vendor profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const homeVendorId = String(profile.vendor_id);
    const homeCompanyId = String(profile.current_company_id || "");

    const { data: homeVendor, error: vendorError } = await admin
      .from("vendors")
      .select("id, company_id, name, contact_person, email, phone, address, city, state, zip_code, logo_url, tax_id, vendor_type, is_active")
      .eq("id", homeVendorId)
      .single();
    if (vendorError || !homeVendor) {
      return new Response(JSON.stringify({ error: "Vendor record not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: linkedCompanies, error: linkedCompaniesError } = await admin
      .from("user_company_access")
      .select("company_id, is_active, companies:company_id(id, company_type)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("role", "vendor");
    if (linkedCompaniesError) throw linkedCompaniesError;

    const externalCompanyIds = ((linkedCompanies || []) as any[])
      .map((row) => ({
        companyId: String(row.company_id || ""),
        companyType: String(row.companies?.company_type || "").toLowerCase(),
      }))
      .filter((row) => row.companyId && row.companyId !== homeCompanyId && row.companyType !== "vendor")
      .map((row) => row.companyId);

    if (externalCompanyIds.length === 0) {
      return new Response(JSON.stringify({ success: true, syncedCompanies: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: homePaymentMethod, error: paymentError } = await admin
      .from("vendor_payment_methods")
      .select("type, bank_name, routing_number, account_number, account_type, check_delivery, pickup_location, voided_check_url, is_primary")
      .eq("vendor_id", homeVendorId)
      .eq("is_primary", true)
      .maybeSingle();
    if (paymentError) throw paymentError;

    const { data: homeComplianceDocs, error: complianceError } = await admin
      .from("vendor_compliance_documents")
      .select("type, is_required, is_uploaded, file_name, file_url, expiration_date, uploaded_at, target_company_id, target_job_id")
      .eq("vendor_id", homeVendorId)
      .in("type", ["w9", "insurance"]);
    if (complianceError) throw complianceError;

    let syncedCount = 0;

    for (const externalCompanyId of externalCompanyIds) {
      const { data: existingVendor, error: existingVendorError } = await admin
        .from("vendors")
        .select("id")
        .eq("company_id", externalCompanyId)
        .eq("email", homeVendor.email)
        .maybeSingle();
      if (existingVendorError) throw existingVendorError;

      let targetVendorId = String(existingVendor?.id || "");
      if (targetVendorId) {
        const { error: updateVendorError } = await admin
          .from("vendors")
          .update({
            name: homeVendor.name,
            contact_person: homeVendor.contact_person,
            email: homeVendor.email,
            phone: homeVendor.phone,
            address: homeVendor.address,
            city: homeVendor.city,
            state: homeVendor.state,
            zip_code: homeVendor.zip_code,
            logo_url: homeVendor.logo_url,
            tax_id: homeVendor.tax_id,
            vendor_type: homeVendor.vendor_type,
            is_active: homeVendor.is_active,
          })
          .eq("id", targetVendorId);
        if (updateVendorError) throw updateVendorError;
      } else {
        const { data: insertedVendor, error: insertVendorError } = await admin
          .from("vendors")
          .insert({
            company_id: externalCompanyId,
            name: homeVendor.name,
            contact_person: homeVendor.contact_person,
            email: homeVendor.email,
            phone: homeVendor.phone,
            address: homeVendor.address,
            city: homeVendor.city,
            state: homeVendor.state,
            zip_code: homeVendor.zip_code,
            logo_url: homeVendor.logo_url,
            tax_id: homeVendor.tax_id,
            vendor_type: homeVendor.vendor_type,
            is_active: homeVendor.is_active,
          })
          .select("id")
          .single();
        if (insertVendorError || !insertedVendor?.id) throw insertVendorError || new Error("Failed to create linked vendor record");
        targetVendorId = String(insertedVendor.id);
      }

      if (homePaymentMethod) {
        const { data: existingTargetPayment, error: existingTargetPaymentError } = await admin
          .from("vendor_payment_methods")
          .select("id")
          .eq("vendor_id", targetVendorId)
          .eq("is_primary", true)
          .maybeSingle();
        if (existingTargetPaymentError) throw existingTargetPaymentError;

        const paymentPayload = {
          vendor_id: targetVendorId,
          type: homePaymentMethod.type,
          bank_name: homePaymentMethod.bank_name,
          routing_number: homePaymentMethod.routing_number,
          account_number: homePaymentMethod.account_number,
          account_type: homePaymentMethod.account_type,
          check_delivery: homePaymentMethod.check_delivery,
          pickup_location: homePaymentMethod.pickup_location,
          voided_check_url: homePaymentMethod.voided_check_url,
          is_primary: true,
        };

        const paymentResponse = existingTargetPayment?.id
          ? await admin.from("vendor_payment_methods").update(paymentPayload).eq("id", existingTargetPayment.id)
          : await admin.from("vendor_payment_methods").insert(paymentPayload);
        if (paymentResponse.error) throw paymentResponse.error;
      }

      const { error: deleteDocsError } = await admin
        .from("vendor_compliance_documents")
        .delete()
        .eq("vendor_id", targetVendorId)
        .in("type", ["w9", "insurance"]);
      if (deleteDocsError) throw deleteDocsError;

      if ((homeComplianceDocs || []).length > 0) {
        const compliancePayload = (homeComplianceDocs || []).map((doc: any) => ({
          vendor_id: targetVendorId,
          type: doc.type,
          is_required: doc.is_required,
          is_uploaded: doc.is_uploaded,
          file_name: doc.file_name,
          file_url: doc.file_url,
          expiration_date: doc.expiration_date,
          uploaded_at: doc.uploaded_at,
          target_company_id: doc.target_company_id,
          target_job_id: doc.target_job_id,
        }));
        const { error: insertDocsError } = await admin
          .from("vendor_compliance_documents")
          .insert(compliancePayload as any);
        if (insertDocsError) throw insertDocsError;
      }

      syncedCount += 1;
    }

    return new Response(JSON.stringify({ success: true, syncedCompanies: syncedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("sync-vendor-portal-data failed:", error);
    return new Response(JSON.stringify({
      error: error?.message || "Failed to sync vendor portal data",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
