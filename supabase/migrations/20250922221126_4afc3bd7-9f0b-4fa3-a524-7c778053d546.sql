-- Add unique constraint for role_permissions to support upserts
DO $$ BEGIN
  ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_menu_item_key UNIQUE (role, menu_item);
EXCEPTION WHEN duplicate_object THEN
  -- constraint already exists
  NULL;
END $$;

-- Create a SECURITY DEFINER function to set role permissions safely
CREATE OR REPLACE FUNCTION public.set_role_permission(
  p_role public.user_role,
  p_menu_item text,
  p_can_access boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can modify role permissions
  IF NOT public.has_role(auth.uid(), 'admin'::public.user_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.role_permissions (role, menu_item, can_access)
  VALUES (p_role, p_menu_item, p_can_access)
  ON CONFLICT (role, menu_item) DO UPDATE
  SET can_access = EXCLUDED.can_access,
      updated_at = now();
END;
$$;