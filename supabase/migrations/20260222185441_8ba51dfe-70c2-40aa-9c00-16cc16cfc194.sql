-- Create a trigger that automatically migrates avatars from punch-photos (private) 
-- to avatars (public) bucket when a profile's avatar_url is updated with a punch-photos URL.
-- Uses pg_net to call the edge function asynchronously.

CREATE OR REPLACE FUNCTION public.trigger_migrate_avatar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _url text;
  _service_role text;
BEGIN
  -- Only fire when avatar_url changes and contains punch-photos
  IF NEW.avatar_url IS NOT NULL 
     AND NEW.avatar_url LIKE '%/punch-photos/%'
     AND (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url) THEN
    
    _url := 'https://watxvzoolmfjfijrgcvq.supabase.co/functions/v1/punch-clock/migrate-avatar';
    _service_role := current_setting('app.settings.service_role_key', true);
    
    -- If service_role key not available, use the supabase_url approach
    PERFORM net.http_post(
      url := _url,
      body := jsonb_build_object(
        'user_id', NEW.user_id::text,
        'source_url', NEW.avatar_url
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach the trigger to profiles table
DROP TRIGGER IF EXISTS on_avatar_punch_photos_migrate ON public.profiles;
CREATE TRIGGER on_avatar_punch_photos_migrate
  AFTER UPDATE OF avatar_url ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_migrate_avatar();