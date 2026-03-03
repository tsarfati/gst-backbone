-- Contract negotiation + signature workflow foundation (manual now, provider-ready later)

ALTER TABLE public.subcontracts
  ADD COLUMN IF NOT EXISTS contract_negotiation_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS vendor_negotiation_notes text,
  ADD COLUMN IF NOT EXISTS vendor_sov_proposal jsonb,
  ADD COLUMN IF NOT EXISTS signature_provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS signature_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS external_signature_envelope_id text,
  ADD COLUMN IF NOT EXISTS awaiting_signature_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_contract_file_url text,
  ADD COLUMN IF NOT EXISTS executed_signed_by_name text,
  ADD COLUMN IF NOT EXISTS executed_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_signer_ip text,
  ADD COLUMN IF NOT EXISTS executed_signer_user_agent text,
  ADD COLUMN IF NOT EXISTS executed_signer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature_consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_consent_text_version text;

ALTER TABLE public.vendor_job_access
  ADD COLUMN IF NOT EXISTS can_negotiate_contracts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_submit_sov_proposals boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_upload_signed_contracts boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subcontracts_signature_provider_check'
      AND conrelid = 'public.subcontracts'::regclass
  ) THEN
    ALTER TABLE public.subcontracts
      ADD CONSTRAINT subcontracts_signature_provider_check
      CHECK (signature_provider IN ('manual', 'docusign'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subcontracts_signature_status_check'
      AND conrelid = 'public.subcontracts'::regclass
  ) THEN
    ALTER TABLE public.subcontracts
      ADD CONSTRAINT subcontracts_signature_status_check
      CHECK (
        signature_status IN (
          'not_started',
          'pending_vendor_review',
          'awaiting_external_signature',
          'signed_uploaded',
          'executed'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subcontracts_contract_negotiation_status_check'
      AND conrelid = 'public.subcontracts'::regclass
  ) THEN
    ALTER TABLE public.subcontracts
      ADD CONSTRAINT subcontracts_contract_negotiation_status_check
      CHECK (
        contract_negotiation_status IN (
          'draft',
          'pending_vendor_review',
          'vendor_review_submitted',
          'internal_review',
          'approved_for_signature'
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contract_signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontract_id uuid NOT NULL REFERENCES public.subcontracts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  event_type text NOT NULL,
  event_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_signature_events_subcontract_id
  ON public.contract_signature_events(subcontract_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_signature_events_company_id
  ON public.contract_signature_events(company_id, created_at DESC);

ALTER TABLE public.contract_signature_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can view contract signature events for company jobs" ON public.contract_signature_events;
CREATE POLICY "Company users can view contract signature events for company jobs"
ON public.contract_signature_events
FOR SELECT
TO authenticated
USING (
  (
    company_id IS NOT NULL
    AND company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  )
  OR (
    EXISTS (
      SELECT 1
      FROM public.subcontracts s
      WHERE s.id = contract_signature_events.subcontract_id
        AND public.user_can_access_job(auth.uid(), s.job_id)
    )
  )
  OR (
    public.is_vendor_user(auth.uid())
    AND vendor_id = public.get_user_vendor_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Company users can insert contract signature events" ON public.contract_signature_events;
CREATE POLICY "Company users can insert contract signature events"
ON public.contract_signature_events
FOR INSERT
TO authenticated
WITH CHECK (
  (
    company_id IS NOT NULL
    AND company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  )
  OR (
    public.is_vendor_user(auth.uid())
    AND vendor_id = public.get_user_vendor_id(auth.uid())
  )
);

ALTER TABLE public.payables_settings
  ADD COLUMN IF NOT EXISTS vendor_portal_signature_provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS vendor_portal_allow_vendor_contract_negotiation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendor_portal_allow_vendor_sov_input boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payables_settings_vendor_portal_signature_provider_check'
      AND conrelid = 'public.payables_settings'::regclass
  ) THEN
    ALTER TABLE public.payables_settings
      ADD CONSTRAINT payables_settings_vendor_portal_signature_provider_check
      CHECK (vendor_portal_signature_provider IN ('manual', 'docusign'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.vendor_submit_subcontract_feedback(
  _subcontract_id uuid,
  _negotiation_notes text DEFAULT NULL,
  _vendor_sov_proposal jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_vendor_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only vendor users can submit contract feedback';
  END IF;

  v_vendor_id := public.get_user_vendor_id(auth.uid());

  SELECT j.company_id
  INTO v_company_id
  FROM public.subcontracts s
  JOIN public.jobs j ON j.id = s.job_id
  WHERE s.id = _subcontract_id
    AND s.vendor_id = v_vendor_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Subcontract not found for vendor';
  END IF;

  UPDATE public.subcontracts
  SET
    vendor_negotiation_notes = COALESCE(_negotiation_notes, vendor_negotiation_notes),
    vendor_sov_proposal = COALESCE(_vendor_sov_proposal, vendor_sov_proposal),
    contract_negotiation_status = 'vendor_review_submitted',
    signature_status = CASE
      WHEN signature_status = 'not_started' THEN 'pending_vendor_review'
      ELSE signature_status
    END,
    updated_at = now()
  WHERE id = _subcontract_id
    AND vendor_id = v_vendor_id;

  INSERT INTO public.contract_signature_events (
    subcontract_id,
    company_id,
    vendor_id,
    actor_user_id,
    actor_role,
    event_type,
    event_note,
    metadata
  ) VALUES (
    _subcontract_id,
    v_company_id,
    v_vendor_id,
    auth.uid(),
    'vendor',
    'vendor_feedback_submitted',
    LEFT(COALESCE(_negotiation_notes, ''), 500),
    jsonb_build_object(
      'has_sov_proposal', _vendor_sov_proposal IS NOT NULL,
      'submitted_at', now()
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_submit_subcontract_signature(
  _subcontract_id uuid,
  _executed_contract_file_url text,
  _signed_by_name text,
  _signer_ip text DEFAULT NULL,
  _signer_user_agent text DEFAULT NULL,
  _consent_text_version text DEFAULT 'v1'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
  v_company_id uuid;
  v_signature_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_vendor_user(auth.uid()) THEN
    RAISE EXCEPTION 'Only vendor users can submit signatures';
  END IF;

  IF _executed_contract_file_url IS NULL OR btrim(_executed_contract_file_url) = '' THEN
    RAISE EXCEPTION 'Executed contract file is required';
  END IF;

  IF _signed_by_name IS NULL OR btrim(_signed_by_name) = '' THEN
    RAISE EXCEPTION 'Signer name is required';
  END IF;

  v_vendor_id := public.get_user_vendor_id(auth.uid());

  SELECT j.company_id, s.signature_status
  INTO v_company_id, v_signature_status
  FROM public.subcontracts s
  JOIN public.jobs j ON j.id = s.job_id
  WHERE s.id = _subcontract_id
    AND s.vendor_id = v_vendor_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Subcontract not found for vendor';
  END IF;

  IF v_signature_status NOT IN ('awaiting_external_signature', 'pending_vendor_review') THEN
    RAISE EXCEPTION 'Subcontract is not ready for signature upload';
  END IF;

  UPDATE public.subcontracts
  SET
    signature_status = 'signed_uploaded',
    executed_contract_file_url = _executed_contract_file_url,
    executed_signed_by_name = _signed_by_name,
    executed_signed_at = now(),
    executed_signer_ip = _signer_ip,
    executed_signer_user_agent = _signer_user_agent,
    executed_signer_user_id = auth.uid(),
    signature_consent_accepted = true,
    signature_consent_accepted_at = now(),
    signature_consent_text_version = COALESCE(NULLIF(btrim(_consent_text_version), ''), 'v1'),
    updated_at = now()
  WHERE id = _subcontract_id
    AND vendor_id = v_vendor_id;

  INSERT INTO public.contract_signature_events (
    subcontract_id,
    company_id,
    vendor_id,
    actor_user_id,
    actor_role,
    event_type,
    event_note,
    metadata
  ) VALUES (
    _subcontract_id,
    v_company_id,
    v_vendor_id,
    auth.uid(),
    'vendor',
    'vendor_signature_uploaded',
    'Vendor uploaded executed contract',
    jsonb_build_object(
      'file_url', _executed_contract_file_url,
      'signed_by', _signed_by_name,
      'signature_status', 'signed_uploaded',
      'submitted_at', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_submit_subcontract_feedback(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_submit_subcontract_signature(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_submit_subcontract_feedback(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_submit_subcontract_signature(uuid, text, text, text, text, text) TO authenticated;
