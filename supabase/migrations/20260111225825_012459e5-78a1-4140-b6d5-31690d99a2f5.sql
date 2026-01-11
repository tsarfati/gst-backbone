-- Fix the handle_new_user trigger to not insert dashboard_settings
-- Dashboard settings should be created when a user gets access to a company, not on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into profiles with profile_completed set to false
  INSERT INTO public.profiles (
    user_id, 
    first_name, 
    last_name, 
    display_name, 
    role,
    profile_completed
  )
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'employee',
    false
  );
  
  -- Note: dashboard_settings requires company_id, so it will be created
  -- when the user is granted access to a company, not on initial signup
  
  RETURN NEW;
END;
$function$;