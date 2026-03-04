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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({} as { limit?: number; query?: string; companyId?: string }));
    const limit = Math.max(1, Math.min(Number(body.limit || 100), 200));
    const query = String(body.query || "").trim();
    const companyId = String(body.companyId || "").trim();
    const toPublicLogoUrl = (logo?: string | null): string | null => {
      if (!logo) return null;
      const trimmed = logo.trim();
      if (!trimmed) return null;
      if (/^(https?:\/\/)/i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
      const objectPath = trimmed.replace(/^company-logos\//, "");
      return `${supabaseUrl}/storage/v1/object/public/company-logos/${objectPath}`;
    };

    let companiesQuery = supabase
      .from("companies")
      .select("id,name,display_name,logo_url")
      .eq("is_active", true);

    if (companyId) {
      companiesQuery = companiesQuery.eq("id", companyId).limit(1);
    } else {
      companiesQuery = companiesQuery
        .order("display_name", { ascending: true })
        .limit(limit);

      if (query) {
        companiesQuery = companiesQuery.or(`name.ilike.%${query}%,display_name.ilike.%${query}%`);
      }
    }

    const { data, error } = await companiesQuery;
    if (error) throw error;

    const companies = Array.isArray(data) ? data : [];
    const companyIds = companies.map((c) => c.id);

    let settingsByCompany = new Map<string, any>();
    if (companyIds.length > 0) {
      const { data: payablesSettings, error: settingsError } = await supabase
        .from("payables_settings")
        .select(`
          company_id,
          vendor_portal_enabled,
          vendor_portal_signup_background_image_url,
          vendor_portal_signup_background_color,
          vendor_portal_signup_company_logo_url,
          vendor_portal_signup_header_logo_url,
          vendor_portal_signup_header_title,
          vendor_portal_signup_header_subtitle,
          vendor_portal_signup_modal_color,
          vendor_portal_signup_modal_opacity,
          design_professional_portal_enabled,
          design_professional_signup_background_image_url,
          design_professional_signup_logo_url,
          design_professional_signup_header_title,
          design_professional_signup_header_subtitle
        `)
        .in("company_id", companyIds);

      if (!settingsError && Array.isArray(payablesSettings)) {
        settingsByCompany = new Map(payablesSettings.map((row: any) => [row.company_id, row]));
      }
    }

    const mergedCompanies = companies
      .map((company: any) => {
        const vendorSettings = settingsByCompany.get(company.id) || {};
        const vendorPortalEnabled = vendorSettings.vendor_portal_enabled ?? true;
        const designPortalEnabled = vendorSettings.design_professional_portal_enabled ?? true;
        if (!vendorPortalEnabled && !designPortalEnabled) return null;

        return {
          id: company.id,
          name: company.name,
          display_name: company.display_name,
          logo_url: toPublicLogoUrl(company.logo_url),
          vendor_portal_enabled: vendorPortalEnabled,
          vendor_portal_signup_background_image_url: toPublicLogoUrl(vendorSettings.vendor_portal_signup_background_image_url),
          vendor_portal_signup_background_color: vendorSettings.vendor_portal_signup_background_color ?? "#030B20",
          vendor_portal_signup_company_logo_url: toPublicLogoUrl(vendorSettings.vendor_portal_signup_company_logo_url),
          vendor_portal_signup_header_logo_url: toPublicLogoUrl(vendorSettings.vendor_portal_signup_header_logo_url),
          vendor_portal_signup_header_title: vendorSettings.vendor_portal_signup_header_title ?? null,
          vendor_portal_signup_header_subtitle: vendorSettings.vendor_portal_signup_header_subtitle ?? null,
          vendor_portal_signup_modal_color: vendorSettings.vendor_portal_signup_modal_color ?? "#071231",
          vendor_portal_signup_modal_opacity: Number(vendorSettings.vendor_portal_signup_modal_opacity ?? 0.96),
          design_professional_portal_enabled: designPortalEnabled,
          design_professional_signup_background_image_url: toPublicLogoUrl(vendorSettings.design_professional_signup_background_image_url),
          design_professional_signup_logo_url: toPublicLogoUrl(vendorSettings.design_professional_signup_logo_url),
          design_professional_signup_header_title: vendorSettings.design_professional_signup_header_title ?? null,
          design_professional_signup_header_subtitle: vendorSettings.design_professional_signup_header_subtitle ?? null,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ companies: mergedCompanies }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in list-public-signup-companies:", error);
    return new Response(JSON.stringify({ error: error?.message || "Failed to load companies" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
