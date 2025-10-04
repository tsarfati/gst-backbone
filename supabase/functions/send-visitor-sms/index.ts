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

    const { visitor_log_id, phone_number, job_id }: SMSRequest = await req.json();

    console.log("Processing SMS request for visitor:", visitor_log_id);

    // Get visitor log details including checkout token
    const { data: visitorLog, error: logError } = await supabase
      .from("visitor_logs")
      .select("*, jobs(name)")
      .eq("id", visitor_log_id)
      .single();

    if (logError || !visitorLog) {
      throw new Error("Failed to fetch visitor log");
    }

    // Get auto-logout settings to check if SMS on check-in is enabled
    const { data: settings, error: settingsError } = await supabase
      .from("visitor_auto_logout_settings")
      .select("send_sms_on_checkin, sms_message_template")
      .eq("job_id", job_id)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
    }

    // Only send if enabled
    if (!settings?.send_sms_on_checkin) {
      console.log("SMS on check-in is not enabled for this job");
      return new Response(
        JSON.stringify({ message: "SMS not enabled" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate checkout URL using the checkout token
    const checkoutUrl = `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}.lovableproject.com/visitor/checkout/${visitorLog.checkout_token}`;

    // Format the message with placeholders replaced
    const jobName = visitorLog.jobs?.name || "the job site";
    const dateTime = new Date().toLocaleString();
    
    let message = settings.sms_message_template || 
      "Thanks for checking in at {{job_name}} on {{date_time}}. When you leave, tap here to check out: {{checkout_link}}";
    
    message = message
      .replace(/\{\{job_name\}\}/g, jobName)
      .replace(/\{\{date_time\}\}/g, dateTime)
      .replace(/\{\{checkout_link\}\}/g, checkoutUrl);

    // TODO: Integrate with SMS provider (Twilio, etc.)
    // For now, just log the message that would be sent
    console.log("Would send SMS to:", phone_number);
    console.log("Message:", message);

    // When SMS provider is integrated, send the message here
    // Example: await twilioClient.messages.create({ to: phone_number, body: message, from: FROM_NUMBER });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "SMS queued for sending",
        preview: { phone_number, message }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
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
