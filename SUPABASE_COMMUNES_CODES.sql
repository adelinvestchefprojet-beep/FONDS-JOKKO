-- JOKKOO Diagnostic : ajouter les codes administratifs aux communes existantes.
-- Migration non destructive : aucune commune, enquête ou profil n'est supprimé.
-- À exécuter une seule fois dans Supabase > SQL Editor.
ALTER TABLE public.communes
  ADD COLUMN IF NOT EXISTS code_departement text,
  ADD COLUMN IF NOT EXISTS code_region text;

COMMENT ON COLUMN public.communes.code IS 'Code officiel de la commune';
COMMENT ON COLUMN public.communes.code_departement IS 'Code officiel du département';
COMMENT ON COLUMN public.communes.departement IS 'Nom du département';
COMMENT ON COLUMN public.communes.code_region IS 'Code officiel de la région';
COMMENT ON COLUMN public.communes.region IS 'Nom de la région';

-- Contrôle des colonnes disponibles après migration :
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'communes'
  AND column_name IN ('code', 'code_departement', 'departement', 'code_region', 'region')
ORDER BY ordinal_position;
