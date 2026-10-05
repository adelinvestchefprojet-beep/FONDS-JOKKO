-- FONDS-JOKKO — Réutilisation sécurisée d'un email après suppression
--
-- Objectif :
-- 1) conserver l'ancien profil et l'historique ;
-- 2) permettre au propriétaire de l'email de réutiliser la même adresse ;
-- 3) ne jamais supprimer directement auth.users depuis le navigateur ;
-- 4) ne jamais donner de privilège admin/super_admin lors de la réactivation.
--
-- Le parcours applicatif demande ensuite une réinitialisation du mot de passe
-- par email. Le propriétaire de la boîte mail doit donc prouver qu'il contrôle
-- toujours cette adresse.

begin;

create or replace function public.prepare_deleted_email_reuse(
  p_email text,
  p_prenom text,
  p_nom text,
  p_telephone text,
  p_commune_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if nullif(trim(p_email), '') is null then
    return false;
  end if;

  select id
    into v_id
  from public.profiles
  where lower(trim(email)) = lower(trim(p_email))
    and statut::text = 'deleted'
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_id is null then
    return false;
  end if;

  -- Un compte recréé depuis le formulaire public redevient toujours
  -- un enquêteur en attente. Aucun privilège historique n'est restauré.
  update public.profiles
  set prenom = nullif(trim(p_prenom), ''),
      nom = nullif(trim(p_nom), ''),
      telephone = nullif(trim(p_telephone), ''),
      commune_id = p_commune_id,
      role = 'enqueteur',
      statut = 'pending',
      approved_at = null,
      approved_by = null,
      updated_at = now()
  where id = v_id
    and statut::text = 'deleted';

  return found;
end;
$$;

revoke all on function public.prepare_deleted_email_reuse(text,text,text,text,uuid) from public;
grant execute on function public.prepare_deleted_email_reuse(text,text,text,text,uuid) to anon, authenticated;

commit;

-- Vérification facultative :
-- select id, prenom, nom, email, role::text, statut::text
-- from public.profiles
-- where lower(email) = lower('adresse@example.com');
