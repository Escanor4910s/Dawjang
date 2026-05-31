-- Fix public_bucket_allows_listing for avatars
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Fix anon_security_definer_function_executable for rls_auto_enable
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public;
