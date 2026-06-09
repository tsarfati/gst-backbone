import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  visitor_log_id: string;
  phone_number: string;
  job_id: string;
  base_url?: string;
}

interface ResolvedSmsProviderSettings {
  provider: string;
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  source: "company" | "builderlynk-default";
}

const normalizePhoneNumber = (value: string): string => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("+")) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return normalized.length > 1 ? normalized : "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
};

const getEnvFirst = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)?.trim();
    if (value) return value;
  }
  return "";
};

const resolveSmsProviderSettings = (smsSettings: any): ResolvedSmsProviderSettings | null => {
  const companyEnabled = smsSettings?.sms_enabled === true;
  const companyProvider = (smsSettings?.provider || "twilio").trim();
  const companyAccountSid = (smsSettings?.account_sid || "").trim();
  const companyAuthToken = (smsSettings?.auth_token || "").trim();
  const companyPhoneNumber = (smsSettings?.phone_number || "").trim();

  if (companyEnabled && companyProvider === "twilio" && companyAccountSid && companyAuthToken && companyPhoneNumber) {
    return {
      provider: "twilio",
      accountSid: companyAccountSid,
      authToken: companyAuthToken,
      phoneNumber: companyPhoneNumber,
      source: "company",
    };
  }

  const defaultAccountSid = getEnvFirst("BUILDERLYNK_TWILIO_ACCOUNT_SID", "TWILIO_ACCOUNT_SID");
  const defaultAuthToken = getEnvFirst("BUILDERLYNK_TWILIO_AUTH_TOKEN", "TWILIO_AUTH_TOKEN");
  const defaultPhoneNumber = getEnvFirst("BUILDERLYNK_TWILIO_PHONE_NUMBER", "TWILIO_PHONE_NUMBER");

  if (defaultAccountSid && defaultAuthToken && defaultPhoneNumber) {
    return {
      provider: "twilio",
      accountSid: defaultAccountSid,
      authToken: defaultAuthToken,
      phoneNumber: defaultPhoneNumber,
      source: "builderlynk-default",
    };
  }

  return null;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { visitor_log_id, phone_number, job_id, base_url }: SMSRequest = await req.json();
    const normalizedPhoneNumber = normalizePhoneNumber(phone_number);

    console.log("Processing SMS request for visitor:", visitor_log_id);

    // Get visitor log details (no embedded selects to avoid FK dependency)
    const { data: visitorLog, error: logError } = await supabase
      .from("visitor_logs")
      .select("id, job_id, checkout_token")
      .eq("id", visitor_log_id)
      .single();

    if (logError || !visitorLog) {
      console.error("Error fetching visitor log:", logError);
      throw new Error("Failed to fetch visitor log");
    }

    // Fetch job for name and company
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, name, company_id")
      .eq("id", visitorLog.job_id)
      .maybeSingle();

    if (jobError) {
      console.error("Error fetching job:", jobError);
    }

    const companyId = job?.company_id;
    if (!companyId) {
      throw new Error("Company ID not found for job");
    }

    // Get company SMS settings
    const { data: smsSettings, error: smsError } = await supabase
      .from("company_sms_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (smsError) {
      console.error("Error fetching SMS settings:", smsError);
      throw new Error("Failed to fetch SMS settings");
    }

    const providerSettings = resolveSmsProviderSettings(smsSettings);

    if (!providerSettings) {
      console.log("SMS is not configured for this company and no BuilderLYNK default SMS account is available");
      return new Response(
        JSON.stringify({
          message: "SMS is not configured",
          diagnostics: {
            company_id: companyId,
            company_sms_enabled: smsSettings?.sms_enabled === true,
            company_provider: smsSettings?.provider || null,
            fallback_account_sid_present: !!getEnvFirst("BUILDERLYNK_TWILIO_ACCOUNT_SID", "TWILIO_ACCOUNT_SID"),
            fallback_auth_token_present: !!getEnvFirst("BUILDERLYNK_TWILIO_AUTH_TOKEN", "TWILIO_AUTH_TOKEN"),
            fallback_phone_present: !!getEnvFirst("BUILDERLYNK_TWILIO_PHONE_NUMBER", "TWILIO_PHONE_NUMBER"),
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!normalizedPhoneNumber) {
      return new Response(
        JSON.stringify({ message: "Invalid phone number format" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get auto-logout settings to check if SMS on check-in is enabled and for the message template
    const { data: autoLogoutSettings } = await supabase
      .from("visitor_auto_logout_settings")
      .select("send_sms_on_checkin, sms_message_template")
      .eq("job_id", job_id)
      .maybeSingle();

    const sendSmsOnCheckIn = autoLogoutSettings?.send_sms_on_checkin ?? true;

    // Only skip when the setting exists and is explicitly disabled.
    if (!sendSmsOnCheckIn) {
      console.log("SMS on check-in is not enabled for this job");
      return new Response(
        JSON.stringify({ message: "SMS on check-in not enabled" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate checkout URL using provided base URL (from client origin) or request origin
    const baseUrl = (base_url || req.headers.get('Origin') || '').replace(/\/$/, '');
    const checkoutUrl = `${baseUrl}/visitor/checkout/${visitorLog.checkout_token}`;

    // Format the message with placeholders replaced
    const jobName = job?.name || "the job site";
    const dateTime = new Date().toLocaleString();
    
    let message = autoLogoutSettings?.sms_message_template || 
      "BuilderLYNK: Thanks for checking in at {{job_name}} on {{date_time}}. When you leave, tap here to check out: {{checkout_link}}";
    
    message = message
      .replace(/\{\{job_name\}\}/g, jobName)
      .replace(/\{\{date_time\}\}/g, dateTime)
      .replace(/\{\{checkout_link\}\}/g, checkoutUrl);

    if (!/builderlynk/i.test(message)) {
      message = `BuilderLYNK: ${message}`;
    }

    // Send SMS using Twilio
    if (providerSettings.provider === 'twilio') {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${providerSettings.accountSid}/Messages.json`;
      
      const formData = new URLSearchParams();
      formData.append('To', normalizedPhoneNumber);
      formData.append('From', providerSettings.phoneNumber);
      formData.append('Body', message);

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${providerSettings.accountSid}:${providerSettings.authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const twilioResult = await twilioResponse.json();

      if (!twilioResponse.ok) {
        console.error("Twilio error:", twilioResult);
        throw new Error(`Twilio API error: ${twilioResult.message || 'Unknown error'}`);
      }

      console.log(`SMS sent successfully via Twilio (${providerSettings.source}):`, twilioResult.sid);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS sent successfully",
          sid: twilioResult.sid,
          provider_source: providerSettings.source,
          normalized_phone_number: normalizedPhoneNumber,
          used_default_job_setting: autoLogoutSettings ? false : true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      console.log("Would send SMS to:", normalizedPhoneNumber);
      console.log("Message:", message);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS provider not configured",
          preview: { phone_number: normalizedPhoneNumber, message }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in send-visitor-sms function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
