DROP FUNCTION IF EXISTS public.get_user_messages(uuid, uuid);

CREATE FUNCTION public.get_user_messages(p_user_id uuid, p_company_id uuid)
RETURNS TABLE(id uuid, from_user_id uuid, to_user_id uuid, subject text, content text, read boolean, created_at timestamptz, thread_id uuid, is_reply boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.id, m.from_user_id, m.to_user_id, m.subject, m.content, m.read, m.created_at, m.thread_id, m.is_reply
  FROM messages m
  WHERE m.company_id = p_company_id
    AND (m.from_user_id = p_user_id OR m.to_user_id = p_user_id)
  ORDER BY m.created_at DESC
  LIMIT 200;
$$;