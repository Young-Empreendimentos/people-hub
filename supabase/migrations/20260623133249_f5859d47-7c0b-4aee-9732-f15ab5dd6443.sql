CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (user_id, nome)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      ''
    )
  )
  ON CONFLICT (user_id) DO UPDATE
  SET nome = COALESCE(NULLIF(public.user_profiles.nome, ''), EXCLUDED.nome);

  RETURN NEW;
END;
$function$;