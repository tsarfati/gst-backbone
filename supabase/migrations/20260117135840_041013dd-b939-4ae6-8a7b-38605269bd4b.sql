-- Add chat notification settings to notification_settings table
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS chat_mention_notifications boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS chat_channel_notifications boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS chat_direct_message_notifications boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.notification_settings.chat_mention_notifications IS 'Notify when user is @mentioned in team chat';
COMMENT ON COLUMN public.notification_settings.chat_channel_notifications IS 'Notify about new messages in subscribed channels';
COMMENT ON COLUMN public.notification_settings.chat_direct_message_notifications IS 'Notify about new direct messages';