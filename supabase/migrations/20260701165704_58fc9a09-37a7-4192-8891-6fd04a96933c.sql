
-- 1) Enforce safe URL schemes on promotions
UPDATE public.promotions SET link_url = NULL WHERE link_url IS NOT NULL AND link_url !~* '^https?://';
UPDATE public.promotions SET image_url = NULL WHERE image_url IS NOT NULL AND image_url !~* '^https?://';

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_link_url_safe_scheme
  CHECK (link_url IS NULL OR link_url ~* '^https?://');

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_image_url_safe_scheme
  CHECK (image_url IS NULL OR image_url ~* '^https?://');

-- 2) New signups default to 'user' role; admins must promote to organizer.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');

  -- Default role is 'user'. Admins must promote accounts to 'organizer' before they can create tournaments/matches.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$function$;
