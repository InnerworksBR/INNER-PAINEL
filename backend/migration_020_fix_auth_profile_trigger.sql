-- A função anterior tentava gravar profiles.email, coluna que não existe.
-- O nome completo pode vir dos metadados; o endpoint administrativo completa
-- o perfil depois que a conta Auth é criada.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'name'), '')
    ),
    'client'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
