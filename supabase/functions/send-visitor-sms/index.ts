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

    // Check if SMS is enabled
    if (!smsSettings?.sms_enabled) {
      console.log("SMS is not enabled for this company");
      return new Response(
        JSON.stringify({ message: "SMS not enabled for this company" }),
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

    // Only send if enabled
    if (!autoLogoutSettings?.send_sms_on_checkin) {
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
    
    let message = autoLogoutSettings.sms_message_template || 
      "Thanks for checking in at {{job_name}} on {{date_time}}. When you leave, tap here to check out: {{checkout_link}}";
    
    message = message
      .replace(/\{\{job_name\}\}/g, jobName)
      .replace(/\{\{date_time\}\}/g, dateTime)
      .replace(/\{\{checkout_link\}\}/g, checkoutUrl);

    // Send SMS using Twilio
    if (smsSettings.provider === 'twilio') {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${smsSettings.account_sid}/Messages.json`;
      
      const formData = new URLSearchParams();
      formData.append('To', phone_number);
      formData.append('From', smsSettings.phone_number);
      formData.append('Body', message);

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${smsSettings.account_sid}:${smsSettings.auth_token}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const twilioResult = await twilioResponse.json();

      if (!twilioResponse.ok) {
        console.error("Twilio error:", twilioResult);
        throw new Error(`Twilio API error: ${twilioResult.message || 'Unknown error'}`);
      }

      console.log("SMS sent successfully via Twilio:", twilioResult.sid);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS sent successfully",
          sid: twilioResult.sid
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      console.log("Would send SMS to:", phone_number);
      console.log("Message:", message);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS provider not configured",
          preview: { phone_number, message }
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
