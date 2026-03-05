-- Extend vendor job access with filing cabinet permissions and scope controls
ALTER TABLE public.vendor_job_access
  ADD COLUMN IF NOT EXISTS can_access_filing_cabinet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS filing_cabinet_access_level text NOT NULL DEFAULT 'view_only',
  ADD COLUMN IF NOT EXISTS can_download_filing_cabinet_files boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_filing_cabinet_folder_ids uuid[] NULL,
  ADD COLUMN IF NOT EXISTS allowed_filing_cabinet_file_ids uuid[] NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_job_access_filing_cabinet_access_level_check'
      AND conrelid = 'public.vendor_job_access'::regclass
  ) THEN
    ALTER TABLE public.vendor_job_access
      ADD CONSTRAINT vendor_job_access_filing_cabinet_access_level_check
      CHECK (filing_cabinet_access_level IN ('view_only', 'read_write'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_vendor_job_access_filing_cabinet_access
  ON public.vendor_job_access(vendor_id, job_id, can_access_filing_cabinet);

-- Replace broad job folder/file policies with vendor-aware access controls.
DROP POLICY IF EXISTS "Users can view job folders in their company" ON public.job_folders;
DROP POLICY IF EXISTS "Users can create job folders in their company" ON public.job_folders;
DROP POLICY IF EXISTS "Users can update job folders in their company" ON public.job_folders;
DROP POLICY IF EXISTS "Users can delete non-system job folders in their company" ON public.job_folders;

CREATE POLICY "Users can view job folders in their company"
ON public.job_folders
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_folders.job_id
        AND vja.can_access_filing_cabinet = true
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_folders.id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
    )
  )
);

CREATE POLICY "Users can create job folders in their company"
ON public.job_folders
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_folders.job_id
        AND vja.can_access_filing_cabinet = true
        AND vja.filing_cabinet_access_level = 'read_write'
        AND vja.allowed_filing_cabinet_folder_ids IS NULL
    )
  )
);

CREATE POLICY "Users can update job folders in their company"
ON public.job_folders
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_folders.job_id
        AND vja.can_access_filing_cabinet = true
        AND vja.filing_cabinet_access_level = 'read_write'
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_folders.id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_folders.job_id
        AND vja.can_access_filing_cabinet = true
        AND vja.filing_cabinet_access_level = 'read_write'
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_folders.id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
    )
  )
);

CREATE POLICY "Users can delete non-system job folders in their company"
ON public.job_folders
FOR DELETE
TO authenticated
USING (
  is_system_folder = false
  AND company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_folders.job_id
        AND vja.can_access_filing_cabinet = true
        AND vja.filing_cabinet_access_level = 'read_write'
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_folders.id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
    )
  )
);

DROP POLICY IF EXISTS "Users can view job files in their company" ON public.job_files;
DROP POLICY IF EXISTS "Users can upload job files in their company" ON public.job_files;
DROP POLICY IF EXISTS "Users can update job files in their company" ON public.job_files;
DROP POLICY IF EXISTS "Users can delete job files in their company" ON public.job_files;

CREATE POLICY "Users can view job files in their company"
ON public.job_files
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_files.job_id
        AND vja.can_access_filing_cabinet = true
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_files.folder_id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
        AND (
          vja.allowed_filing_cabinet_file_ids IS NULL
          OR job_files.id = ANY(vja.allowed_filing_cabinet_file_ids)
        )
    )
  )
);

CREATE POLICY "Users can upload job files in their company"
ON public.job_files
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_files.job_id
        AND vja.can_access_filing_cabinet = true
        AND vja.filing_cabinet_access_level = 'read_write'
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_files.folder_id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
    )
  )
);

CREATE POLICY "Users can update job files in their company"
ON public.job_files
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_files.job_id
        AND vja.can_access_filing_cabinet = true
        AND vja.filing_cabinet_access_level = 'read_write'
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_files.folder_id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
        AND (
          vja.allowed_filing_cabinet_file_ids IS NULL
          OR job_files.id = ANY(vja.allowed_filing_cabinet_file_ids)
        )
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_files.job_id
        AND vja.can_access_filing_cabinet = true
        AND vja.filing_cabinet_access_level = 'read_write'
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_files.folder_id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
        AND (
          vja.allowed_filing_cabinet_file_ids IS NULL
          OR job_files.id = ANY(vja.allowed_filing_cabinet_file_ids)
        )
    )
  )
);

CREATE POLICY "Users can delete job files in their company"
ON public.job_files
FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT uca.company_id
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND COALESCE(uca.is_active, true) = true
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_job_access vja
        ON vja.vendor_id = p.vendor_id
      WHERE p.user_id = auth.uid()
        AND p.role::text IN ('vendor', 'design_professional')
        AND p.vendor_id IS NOT NULL
        AND vja.job_id = job_files.job_id
        AND vja.can_access_filing_cabinet = true
        AND vja.filing_cabinet_access_level = 'read_write'
        AND (
          vja.allowed_filing_cabinet_folder_ids IS NULL
          OR job_files.folder_id = ANY(vja.allowed_filing_cabinet_folder_ids)
        )
        AND (
          vja.allowed_filing_cabinet_file_ids IS NULL
          OR job_files.id = ANY(vja.allowed_filing_cabinet_file_ids)
        )
    )
  )
);
