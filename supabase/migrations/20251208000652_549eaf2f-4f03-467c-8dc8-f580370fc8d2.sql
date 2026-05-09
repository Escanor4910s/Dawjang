-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING ((SELECT auth.uid()) = user_id OR public.is_admin());

CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.is_admin());

-- Add additional profile fields for extended user info
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS student_number text,
ADD COLUMN IF NOT EXISTS university text,
ADD COLUMN IF NOT EXISTS year_of_study text;