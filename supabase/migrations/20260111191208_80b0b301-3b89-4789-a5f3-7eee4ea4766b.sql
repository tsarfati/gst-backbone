-- =============================================
-- MULTI-TENANT ARCHITECTURE
-- =============================================

-- Enum for tenant member roles
CREATE TYPE public.tenant_role AS ENUM ('owner', 'admin', 'member');

-- Enum for tenant subscription tiers
CREATE TYPE public.subscription_tier AS ENUM ('free', 'starter', 'professional', 'enterprise');

-- Enum for access request status
CREATE TYPE public.tenant_request_status AS ENUM ('pending', 'approved', 'rejected');

-- =============================================
-- TENANTS TABLE
-- =============================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  max_companies INTEGER NOT NULL DEFAULT 999, -- Unlimited for now (free tier)
  is_active BOOLEAN NOT NULL DEFAULT true,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TENANT MEMBERS TABLE
-- =============================================
CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TENANT ACCESS REQUESTS TABLE
-- =============================================
CREATE TABLE public.tenant_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'join', -- 'join' existing or 'create' new tenant
  tenant_name TEXT, -- For create requests
  notes TEXT,
  status tenant_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_access_requests ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SUPER ADMINS TABLE (separate from regular roles)
-- =============================================
CREATE TABLE public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ADD TENANT_ID TO COMPANIES
-- =============================================
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON public.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON public.tenant_members(tenant_id);

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Check if user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- Check if user is a member of a tenant
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- Check if user is tenant owner or admin
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id 
      AND tenant_id = _tenant_id 
      AND role IN ('owner', 'admin')
  )
$$;

-- Get user's current tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- =============================================
-- RLS POLICIES FOR TENANTS
-- =============================================

-- Super admins can see all tenants
CREATE POLICY "Super admins can view all tenants"
ON public.tenants FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Tenant members can view their own tenant
CREATE POLICY "Members can view their tenant"
ON public.tenants FOR SELECT
USING (public.is_tenant_member(auth.uid(), id));

-- Tenant owners/admins can update their tenant
CREATE POLICY "Tenant admins can update tenant"
ON public.tenants FOR UPDATE
USING (public.is_tenant_admin(auth.uid(), id));

-- Super admins can insert tenants
CREATE POLICY "Super admins can create tenants"
ON public.tenants FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

-- =============================================
-- RLS POLICIES FOR TENANT MEMBERS
-- =============================================

-- Super admins can see all members
CREATE POLICY "Super admins can view all members"
ON public.tenant_members FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Tenant members can see other members in their tenant
CREATE POLICY "Members can view tenant members"
ON public.tenant_members FOR SELECT
USING (public.is_tenant_member(auth.uid(), tenant_id));

-- Tenant admins can manage members
CREATE POLICY "Tenant admins can insert members"
ON public.tenant_members FOR INSERT
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id) 
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can update members"
ON public.tenant_members FOR UPDATE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id) 
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant admins can delete members"
ON public.tenant_members FOR DELETE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id) 
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- RLS POLICIES FOR ACCESS REQUESTS
-- =============================================

-- Users can see their own requests
CREATE POLICY "Users can view own requests"
ON public.tenant_access_requests FOR SELECT
USING (user_id = auth.uid());

-- Tenant admins can see requests for their tenant
CREATE POLICY "Tenant admins can view requests"
ON public.tenant_access_requests FOR SELECT
USING (
  public.is_tenant_admin(auth.uid(), tenant_id) 
  OR public.is_super_admin(auth.uid())
);

-- Authenticated users can create requests
CREATE POLICY "Users can create requests"
ON public.tenant_access_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Tenant admins and super admins can update requests
CREATE POLICY "Admins can update requests"
ON public.tenant_access_requests FOR UPDATE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id) 
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- RLS POLICIES FOR SUPER ADMINS
-- =============================================

-- Only super admins can see the super_admins table
CREATE POLICY "Super admins can view super admins"
ON public.super_admins FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Only super admins can manage super admins
CREATE POLICY "Super admins can insert super admins"
ON public.super_admins FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

-- =============================================
-- UPDATE COMPANIES RLS TO INCLUDE TENANT
-- =============================================

-- Add policy for tenant-based access to companies
CREATE POLICY "Tenant members can view companies in their tenant"
ON public.companies FOR SELECT
USING (
  tenant_id IS NULL 
  OR public.is_tenant_member(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tenant_members_updated_at
  BEFORE UPDATE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tenant_access_requests_updated_at
  BEFORE UPDATE ON public.tenant_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- FUNCTION TO APPROVE TENANT REQUEST
-- =============================================

CREATE OR REPLACE FUNCTION public.approve_tenant_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_tenant_id UUID;
BEGIN
  -- Get the request
  SELECT * INTO v_request FROM public.tenant_access_requests WHERE id = p_request_id;
  
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;
  
  -- Check authorization
  IF NOT (
    public.is_super_admin(auth.uid()) 
    OR (v_request.tenant_id IS NOT NULL AND public.is_tenant_admin(auth.uid(), v_request.tenant_id))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Handle based on request type
  IF v_request.request_type = 'create' THEN
    -- Create new tenant
    INSERT INTO public.tenants (name, slug, owner_id)
    VALUES (
      v_request.tenant_name,
      lower(replace(v_request.tenant_name, ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 8),
      v_request.user_id
    )
    RETURNING id INTO v_tenant_id;
    
    -- Add user as owner
    INSERT INTO public.tenant_members (tenant_id, user_id, role, invited_by)
    VALUES (v_tenant_id, v_request.user_id, 'owner', auth.uid());
  ELSE
    -- Add user to existing tenant
    INSERT INTO public.tenant_members (tenant_id, user_id, role, invited_by)
    VALUES (v_request.tenant_id, v_request.user_id, 'member', auth.uid())
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
  
  -- Update request status
  UPDATE public.tenant_access_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_request_id;
END;
$$;