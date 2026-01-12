-- Remove the incorrect super admin entry (keeping only msarfati@gmail.com)
DELETE FROM super_admins 
WHERE user_id = 'fa67f9ba-67fc-4708-9526-7bfef906dae3';