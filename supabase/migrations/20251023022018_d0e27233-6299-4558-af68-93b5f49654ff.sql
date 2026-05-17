-- Enable pg_cron extension for scheduled jobs
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file OR feature_not_supported THEN
      NULL;
  END;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file OR feature_not_supported THEN
      NULL;
  END;
END;
$$;

-- Schedule daily overdue bill notifications at 8 AM
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule('daily-overdue-bill-notifications');

    PERFORM cron.schedule(
      'daily-overdue-bill-notifications',
      '0 8 * * *',
      $schedule$
      SELECT
        net.http_post(
            url:='https://watxvzoolmfjfijrgcvq.supabase.co/functions/v1/send-overdue-bill-notifications',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q"}'::jsonb,
            body:=concat('{"time": "', now(), '"}')::jsonb
        ) as request_id;
      $schedule$
    );
  END IF;
EXCEPTION
  WHEN undefined_function OR undefined_table OR invalid_schema_name THEN
    NULL;
END;
$$;
