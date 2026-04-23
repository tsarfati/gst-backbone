import { supabase } from "@/integrations/supabase/client";

type SendDirectMessageNotificationParams = {
  companyId: string;
  actorUserId?: string | null;
  recipientUserIds: string[];
  subject?: string | null;
  content: string;
};

export async function sendDirectMessageNotifications(
  params: SendDirectMessageNotificationParams,
): Promise<void> {
  const { error } = await supabase.functions.invoke("send-direct-message-notification", {
    body: params,
  });

  if (error) throw error;
}
