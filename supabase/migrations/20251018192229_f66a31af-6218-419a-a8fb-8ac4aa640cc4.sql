-- Create custom roles table
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  role_name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'bg-gray-100 text-gray-800',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, role_key)
);

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view custom roles for their companies
CREATE POLICY "Users can view custom roles for their companies"
ON public.custom_roles
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_company_access
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Policy: Admins can manage custom roles
CREATE POLICY "Admins can manage custom roles"
ON public.custom_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX idx_custom_roles_company_id ON public.custom_roles(company_id);
CREATE INDEX idx_custom_roles_role_key ON public.custom_roles(role_key);

-- Add trigger for updated_at
CREATE TRIGGER update_custom_roles_updated_at
BEFORE UPDATE ON public.custom_roles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create custom role permissions table (similar to role_permissions but for custom roles)
CREATE TABLE IF NOT EXISTS public.custom_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_role_id UUID NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  menu_item TEXT NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(custom_role_id, menu_item)
);

-- Enable RLS
ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view custom role permissions for their company roles
CREATE POLICY "Users can view custom role permissions"
ON public.custom_role_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM custom_roles
    WHERE custom_roles.id = custom_role_permissions.custom_role_id
    AND custom_roles.company_id IN (
      SELECT company_id FROM user_company_access
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);

-- Policy: Admins can manage custom role permissions
CREATE POLICY "Admins can manage custom role permissions"
ON public.custom_role_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create index
CREATE INDEX idx_custom_role_permissions_role_id ON public.custom_role_permissions(custom_role_id);

-- Add trigger for updated_at
CREATE TRIGGER update_custom_role_permissions_updated_at
BEFORE UPDATE ON public.custom_role_permissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add custom_role_id to profiles table to allow users to have custom roles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;