alter table public.job_photos
  add column if not exists rotation_degrees integer not null default 0;

comment on column public.job_photos.rotation_degrees is
  'Saved clockwise rotation in degrees for the photo viewer, typically 0/90/180/270.';
