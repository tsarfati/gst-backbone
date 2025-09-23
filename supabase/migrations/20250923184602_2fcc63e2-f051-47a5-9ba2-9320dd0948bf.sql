-- Create edge function to get Mapbox token
CREATE OR REPLACE FUNCTION public.get_mapbox_token()
RETURNS TEXT AS $$
BEGIN
    -- This is a placeholder - the actual token will be set in edge function
    RETURN '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;