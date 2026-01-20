-- Add field to distinguish directory members from project team members
ALTER TABLE public.job_project_directory 
ADD COLUMN is_project_team_member BOOLEAN DEFAULT false;

-- Create index for filtering project team members
CREATE INDEX idx_job_project_directory_team_member ON public.job_project_directory(job_id, is_project_team_member) WHERE is_active = true;