-- Enable required extensions for scheduled tasks when available in the local replay environment.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file OR feature_not_supported THEN
      NULL;
  END;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file OR feature_not_supported THEN
      NULL;
  END;
END;
$$;

-- Create a cron job to auto-logout visitors every 15 minutes when both extensions are available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule('auto-logout-visitors-job');

    PERFORM cron.schedule(
      'auto-logout-visitors-job',
      '*/15 * * * *',
      $schedule$
      SELECT
        net.http_post(
            url:='https://watxvzoolmfjfijrgcvq.supabase.co/functions/v1/auto-logout-visitors',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q"}'::jsonb,
            body:=concat('{"triggered_at": "', now(), '"}')::jsonb
        ) as request_id;
      $schedule$
    );
  END IF;
EXCEPTION
  WHEN undefined_function OR undefined_table OR invalid_schema_name THEN
    NULL;
END;
$$;
