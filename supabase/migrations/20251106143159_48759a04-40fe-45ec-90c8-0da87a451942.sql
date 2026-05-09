-- Fix function search_path security issue
-- Recreate the handle_new_user function with a fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$function$;