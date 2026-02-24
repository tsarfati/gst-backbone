-- Add optional custom role assignment support to user invitation records.
-- The invite flow still stores a base system role in `role`, and can now also
-- persist a `custom_role_id` to apply after acceptance.

ALTER TABLE public.pending_user_invites
ADD COLUMN IF NOT EXISTS custom_role_id UUID NULL REFERENCES public.custom_roles(id) ON DELETE SET NULL;

ALTER TABLE public.user_invitations
ADD COLUMN IF NOT EXISTS custom_role_id UUID NULL REFERENCES public.custom_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pending_user_invites_custom_role_id
  ON public.pending_user_invites(custom_role_id);

CREATE INDEX IF NOT EXISTS idx_user_invitations_custom_role_id
  ON public.user_invitations(custom_role_id);
