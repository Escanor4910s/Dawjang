-- Insert admin role for tallathiam232@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('e647256e-12a1-46b4-8362-22ffa6ecec5f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;