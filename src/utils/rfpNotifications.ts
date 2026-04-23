import { supabase } from "@/integrations/supabase/client";

type RfpNotificationPreferenceKey =
  | "rfp_update_notifications"
  | "rfp_plan_update_notifications"
  | "rfp_comment_update_notifications";

type CreateRfpNotificationsParams = {
  rfpId: string;
  companyId: string;
  actorUserId?: string | null;
  title: string;
  message: string;
  preferenceKey: RfpNotificationPreferenceKey;
};

export async function createRfpNotifications(params: CreateRfpNotificationsParams): Promise<void> {
  const { error } = await supabase.functions.invoke("send-rfp-update-notification", {
    body: params,
  });

  if (error) {
    throw error;
  }
}
