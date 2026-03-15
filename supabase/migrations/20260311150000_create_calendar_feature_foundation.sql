-- Calendar foundation for user scheduling, shared company/job calendars,
-- Google Calendar sync, and Google Meet link storage.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_event_visibility'
  ) THEN
    CREATE TYPE public.calendar_event_visibility AS ENUM (
      'private',
      'attendees',
      'company',
      'job'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_event_status'
  ) THEN
    CREATE TYPE public.calendar_event_status AS ENUM (
      'confirmed',
      'tentative',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_event_type'
  ) THEN
    CREATE TYPE public.calendar_event_type AS ENUM (
      'meeting',
      'site_visit',
      'inspection',
      'deadline',
      'reminder',
      'task',
      'other'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_sync_source'
  ) THEN
    CREATE TYPE public.calendar_sync_source AS ENUM (
      'builderlink',
      'google'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_sync_state'
  ) THEN
    CREATE TYPE public.calendar_sync_state AS ENUM (
      'pending',
      'synced',
      'conflict',
      'error'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_attendee_role'
  ) THEN
    CREATE TYPE public.calendar_attendee_role AS ENUM (
      'organizer',
      'required',
      'optional'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_attendee_response_status'
  ) THEN
    CREATE TYPE public.calendar_attendee_response_status AS ENUM (
      'needs_action',
      'accepted',
      'declined',
      'tentative'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_connection_provider'
  ) THEN
    CREATE TYPE public.calendar_connection_provider AS ENUM (
      'google'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_sync_action'
  ) THEN
    CREATE TYPE public.calendar_sync_action AS ENUM (
      'create',
      'update',
      'delete',
      'pull'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendar_sync_job_status'
  ) THEN
    CREATE TYPE public.calendar_sync_job_status AS ENUM (
      'queued',
      'processing',
      'done',
      'failed'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  visibility public.calendar_event_visibility NOT NULL DEFAULT 'private',
  status public.calendar_event_status NOT NULL DEFAULT 'confirmed',
  event_type public.calendar_event_type NOT NULL DEFAULT 'meeting',
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  google_calendar_id TEXT,
  google_event_id TEXT,
  google_meet_url TEXT,
  sync_source public.calendar_sync_source NOT NULL DEFAULT 'builderlink',
  sync_state public.calendar_sync_state NOT NULL DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  external_etag TEXT,
  create_google_meet BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_time_range_check CHECK (end_at >= start_at),
  CONSTRAINT calendar_events_job_visibility_requires_job CHECK (
    visibility <> 'job' OR job_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.calendar_event_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  display_name TEXT,
  attendee_role public.calendar_attendee_role NOT NULL DEFAULT 'required',
  response_status public.calendar_attendee_response_status NOT NULL DEFAULT 'needs_action',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_event_attendees_identity_check CHECK (
    user_id IS NOT NULL OR email IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.user_calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.calendar_connection_provider NOT NULL DEFAULT 'google',
  provider_account_email TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  default_calendar_id TEXT,
  default_calendar_name TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  meet_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_cursor TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.calendar_sync_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.user_calendar_connections(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  action public.calendar_sync_action NOT NULL,
  status public.calendar_sync_job_status NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id
  ON public.calendar_events(company_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_user_id
  ON public.calendar_events(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_job_id
  ON public.calendar_events(job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_time_window
  ON public.calendar_events(start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event
  ON public.calendar_events(google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_event_attendees_event_id
  ON public.calendar_event_attendees(event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_attendees_user_id
  ON public.calendar_event_attendees(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_attendees_unique_user
  ON public.calendar_event_attendees(event_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_event_attendees_unique_email
  ON public.calendar_event_attendees(event_id, lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_sync_queue_status_run_after
  ON public.calendar_sync_queue(status, run_after);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_manage_calendar_company(_user uuid, _company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(public.is_super_admin(_user), false)
    OR EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = _user
        AND uca.company_id = _company
        AND uca.is_active = true
        AND lower(uca.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_calendar_event(_user uuid, _event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.calendar_events ce
    WHERE ce.id = _event
      AND ce.is_deleted = false
      AND (
        ce.owner_user_id = _user
        OR ce.created_by = _user
        OR public.user_can_manage_calendar_company(_user, ce.company_id)
        OR (
          ce.visibility = 'private'
          AND EXISTS (
            SELECT 1
            FROM public.calendar_event_attendees cea
            WHERE cea.event_id = ce.id
              AND cea.user_id = _user
          )
        )
        OR (
          ce.visibility = 'attendees'
          AND EXISTS (
            SELECT 1
            FROM public.calendar_event_attendees cea
            WHERE cea.event_id = ce.id
              AND cea.user_id = _user
          )
        )
        OR (
          ce.visibility = 'company'
          AND EXISTS (
            SELECT 1
            FROM public.user_company_access uca
            WHERE uca.user_id = _user
              AND uca.company_id = ce.company_id
              AND uca.is_active = true
          )
        )
        OR (
          ce.visibility = 'job'
          AND ce.job_id IS NOT NULL
          AND public.user_can_access_job(_user, ce.job_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_calendar_event(_user uuid, _event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.calendar_events ce
    WHERE ce.id = _event
      AND (
        ce.owner_user_id = _user
        OR ce.created_by = _user
        OR public.user_can_manage_calendar_company(_user, ce.company_id)
      )
  );
$$;

DROP POLICY IF EXISTS "Users can view calendar events" ON public.calendar_events;
CREATE POLICY "Users can view calendar events"
ON public.calendar_events
FOR SELECT
USING (
  public.user_can_view_calendar_event(auth.uid(), id)
);

DROP POLICY IF EXISTS "Users can insert calendar events" ON public.calendar_events;
CREATE POLICY "Users can insert calendar events"
ON public.calendar_events
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (
    owner_user_id = auth.uid()
    OR public.user_can_manage_calendar_company(auth.uid(), company_id)
  )
  AND EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = calendar_events.company_id
      AND uca.is_active = true
  )
  AND (
    job_id IS NULL
    OR public.user_can_access_job(auth.uid(), job_id)
  )
  AND (
    vendor_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = vendor_id
        AND v.company_id = calendar_events.company_id
    )
  )
  AND (
    customer_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.company_id = calendar_events.company_id
    )
  )
);

DROP POLICY IF EXISTS "Users can update calendar events" ON public.calendar_events;
CREATE POLICY "Users can update calendar events"
ON public.calendar_events
FOR UPDATE
USING (
  public.user_can_manage_calendar_event(auth.uid(), id)
)
WITH CHECK (
  public.user_can_manage_calendar_event(auth.uid(), id)
  AND EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = calendar_events.company_id
      AND uca.is_active = true
  )
  AND (
    job_id IS NULL
    OR public.user_can_access_job(auth.uid(), job_id)
  )
  AND (
    vendor_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = vendor_id
        AND v.company_id = calendar_events.company_id
    )
  )
  AND (
    customer_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.company_id = calendar_events.company_id
    )
  )
);

DROP POLICY IF EXISTS "Users can delete calendar events" ON public.calendar_events;
CREATE POLICY "Users can delete calendar events"
ON public.calendar_events
FOR DELETE
USING (
  public.user_can_manage_calendar_event(auth.uid(), id)
);

DROP POLICY IF EXISTS "Users can view calendar attendees" ON public.calendar_event_attendees;
CREATE POLICY "Users can view calendar attendees"
ON public.calendar_event_attendees
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.user_can_view_calendar_event(auth.uid(), event_id)
);

DROP POLICY IF EXISTS "Users can insert calendar attendees" ON public.calendar_event_attendees;
CREATE POLICY "Users can insert calendar attendees"
ON public.calendar_event_attendees
FOR INSERT
WITH CHECK (
  public.user_can_manage_calendar_event(auth.uid(), event_id)
);

DROP POLICY IF EXISTS "Users can update calendar attendees" ON public.calendar_event_attendees;
CREATE POLICY "Users can update calendar attendees"
ON public.calendar_event_attendees
FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.user_can_manage_calendar_event(auth.uid(), event_id)
)
WITH CHECK (
  (
    user_id = auth.uid()
    AND public.user_can_view_calendar_event(auth.uid(), event_id)
  )
  OR public.user_can_manage_calendar_event(auth.uid(), event_id)
);

DROP POLICY IF EXISTS "Users can delete calendar attendees" ON public.calendar_event_attendees;
CREATE POLICY "Users can delete calendar attendees"
ON public.calendar_event_attendees
FOR DELETE
USING (
  public.user_can_manage_calendar_event(auth.uid(), event_id)
);

DROP POLICY IF EXISTS "Users can view their calendar connections" ON public.user_calendar_connections;
CREATE POLICY "Users can view their calendar connections"
ON public.user_calendar_connections
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their calendar connections" ON public.user_calendar_connections;
CREATE POLICY "Users can insert their calendar connections"
ON public.user_calendar_connections
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their calendar connections" ON public.user_calendar_connections;
CREATE POLICY "Users can update their calendar connections"
ON public.user_calendar_connections
FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their calendar connections" ON public.user_calendar_connections;
CREATE POLICY "Users can delete their calendar connections"
ON public.user_calendar_connections
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view their calendar sync queue" ON public.calendar_sync_queue;
CREATE POLICY "Users can view their calendar sync queue"
ON public.calendar_sync_queue
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_calendar_connections ucc
    WHERE ucc.id = calendar_sync_queue.connection_id
      AND (
        ucc.user_id = auth.uid()
        OR public.is_super_admin(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can insert their calendar sync queue" ON public.calendar_sync_queue;
CREATE POLICY "Users can insert their calendar sync queue"
ON public.calendar_sync_queue
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_calendar_connections ucc
    WHERE ucc.id = calendar_sync_queue.connection_id
      AND (
        ucc.user_id = auth.uid()
        OR public.is_super_admin(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can update their calendar sync queue" ON public.calendar_sync_queue;
CREATE POLICY "Users can update their calendar sync queue"
ON public.calendar_sync_queue
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_calendar_connections ucc
    WHERE ucc.id = calendar_sync_queue.connection_id
      AND (
        ucc.user_id = auth.uid()
        OR public.is_super_admin(auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_calendar_connections ucc
    WHERE ucc.id = calendar_sync_queue.connection_id
      AND (
        ucc.user_id = auth.uid()
        OR public.is_super_admin(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can delete their calendar sync queue" ON public.calendar_sync_queue;
CREATE POLICY "Users can delete their calendar sync queue"
ON public.calendar_sync_queue
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_calendar_connections ucc
    WHERE ucc.id = calendar_sync_queue.connection_id
      AND (
        ucc.user_id = auth.uid()
        OR public.is_super_admin(auth.uid())
      )
  )
);

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_event_attendees_updated_at ON public.calendar_event_attendees;
CREATE TRIGGER update_calendar_event_attendees_updated_at
BEFORE UPDATE ON public.calendar_event_attendees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_calendar_connections_updated_at ON public.user_calendar_connections;
CREATE TRIGGER update_user_calendar_connections_updated_at
BEFORE UPDATE ON public.user_calendar_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_sync_queue_updated_at ON public.calendar_sync_queue;
CREATE TRIGGER update_calendar_sync_queue_updated_at
BEFORE UPDATE ON public.calendar_sync_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
