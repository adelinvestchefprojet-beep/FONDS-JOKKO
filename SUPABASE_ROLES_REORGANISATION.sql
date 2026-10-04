-- FONDS-JOKKO — REORGANISATION SECURISEE DES ROLES
--
-- Objectif :
--   SUPER ADMIN : pouvoir technique global
--   ADMIN        : supervision centrale de toutes les communes/enquetes
--   ENQUETEUR    : uniquement son espace et ses propres enquetes
--
-- IMPORTANT : ce script ne supprime aucune donnee et ne supprime aucun profil.
-- Il ne modifie pas les comptes Auth. Il prepare/verrouille la structure public.profiles.
-- A executer dans Supabase SQL Editor.

begin;

-- 1) Table de rattachement commune : uniquement utile si l'on souhaite
-- conserver des affectations administratives historiques. L'ADMIN central
-- n'en depend PAS pour son acces global.
create table if not exists public.admin_communes (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  commune_id uuid not null references public.communes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (admin_id, commune_id)
);

alter table public.admin_communes enable row level security;

-- 2) Contraintes de coherence des roles.
-- Aucun ADMIN ne doit etre rattache a une commune.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_admin_no_commune'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_admin_no_commune
      check (role::text <> 'admin' or commune_id is null);
  end if;
end $$;

-- 3) Fonction de securite : role de l'utilisateur authentifie.
-- SECURITY DEFINER + search_path fixe pour eviter les manipulations de search_path.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- 4) Fonctions de controle reutilisables.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text = 'super_admin'
      and p.statut::text = 'active'
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text in ('admin','super_admin')
      and p.statut::text = 'active'
  )
$$;

create or replace function public.is_active_enqueteur()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text = 'enqueteur'
      and p.statut::text = 'active'
  )
$$;

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_active_enqueteur() from public;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_enqueteur() to authenticated;

-- 5) Garantir qu'il n'existe qu'UN seul SUPER ADMIN actif et UN seul ADMIN actif.
-- Index partiels : aucune fonction non-immutable dans le predicate.
create unique index if not exists uq_profiles_one_super_admin_active
on public.profiles ((role::text))
where role::text = 'super_admin' and statut::text = 'active';

create unique index if not exists uq_profiles_one_admin_active
on public.profiles ((role::text))
where role::text = 'admin' and statut::text = 'active';

-- 6) Trigger : ADMIN central => aucune commune.
create or replace function public.enforce_role_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.role::text = 'admin' then
    NEW.commune_id := null;
  end if;

  -- Un profil supprime/inactif ne peut pas rester un role privilegie actif.
  if NEW.statut::text <> 'active' and NEW.role::text in ('admin','super_admin') then
    -- On conserve le role historique mais il perd l'acces via les fonctions RLS.
    null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_role_rules on public.profiles;
create trigger trg_enforce_role_rules
before insert or update on public.profiles
for each row execute function public.enforce_role_rules();

-- 7) RLS profiles :
--    SUPER ADMIN : tout
--    ADMIN       : lecture des profils, mais pas elevation de privileges
--    ENQUETEUR   : son profil uniquement
alter table public.profiles enable row level security;

drop policy if exists profiles_sa_all on public.profiles;
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_staff_read on public.profiles;
drop policy if exists profiles_admin_read on public.profiles;
drop policy if exists profiles_admin_update_limited on public.profiles;

create policy profiles_sa_all
on public.profiles
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy profiles_admin_read
on public.profiles
for select to authenticated
using (public.is_admin());

create policy profiles_self_read
on public.profiles
for select to authenticated
using (user_id = auth.uid());

create policy profiles_self_update
on public.profiles
for update to authenticated
using (user_id = auth.uid() and role::text = 'enqueteur' and statut::text = 'active')
with check (
  user_id = auth.uid()
  and role::text = 'enqueteur'
  and statut::text = 'active'
);

-- 8) RLS ENQUETES :
--    ADMIN/SUPER ADMIN voient tout.
--    ENQUETEUR voit/modifie uniquement ses propres enquêtes.
alter table public.enquetes enable row level security;

drop policy if exists enq_sa_all on public.enquetes;
drop policy if exists enq_admin_read on public.enquetes;
drop policy if exists enq_own_select on public.enquetes;
drop policy if exists enq_own_insert on public.enquetes;
drop policy if exists enq_own_update on public.enquetes;

create policy enq_sa_all
on public.enquetes
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy enq_admin_read
on public.enquetes
for select to authenticated
using (public.is_admin());

create policy enq_own_select
on public.enquetes
for select to authenticated
using (
  public.is_active_enqueteur()
  and enqueteur_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
);

create policy enq_own_insert
on public.enquetes
for insert to authenticated
with check (
  public.is_active_enqueteur()
  and enqueteur_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  and commune_id = (select p.commune_id from public.profiles p where p.user_id = auth.uid() limit 1)
);

create policy enq_own_update
on public.enquetes
for update to authenticated
using (
  public.is_active_enqueteur()
  and enqueteur_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
)
with check (
  public.is_active_enqueteur()
  and enqueteur_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  and commune_id = (select p.commune_id from public.profiles p where p.user_id = auth.uid() limit 1)
);

-- 9) Commentaires : ADMIN/SUPER ADMIN peuvent superviser ; enquêteur uniquement
--    les commentaires des enquêtes dont il est propriétaire.
alter table public.commentaires_enquetes enable row level security;

drop policy if exists com_sa_all on public.commentaires_enquetes;
drop policy if exists com_admin_read on public.commentaires_enquetes;
drop policy if exists com_own_read on public.commentaires_enquetes;
drop policy if exists com_own_insert on public.commentaires_enquetes;
drop policy if exists com_own_mark on public.commentaires_enquetes;

create policy com_sa_all
on public.commentaires_enquetes
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy com_admin_read
on public.commentaires_enquetes
for select to authenticated
using (public.is_admin());

create policy com_own_read
on public.commentaires_enquetes
for select to authenticated
using (
  public.is_active_enqueteur()
  and exists (
    select 1 from public.enquetes e
    where e.id = commentaires_enquetes.enquete_id
      and e.enqueteur_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  )
);

create policy com_own_insert
on public.commentaires_enquetes
for insert to authenticated
with check (
  public.is_active_enqueteur()
  and auteur_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  and exists (
    select 1 from public.enquetes e
    where e.id = commentaires_enquetes.enquete_id
      and e.enqueteur_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  )
);

create policy com_own_mark
on public.commentaires_enquetes
for update to authenticated
using (
  public.is_active_enqueteur()
  and exists (
    select 1 from public.enquetes e
    where e.id = commentaires_enquetes.enquete_id
      and e.enqueteur_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  )
)
with check (true);

-- 10) Notifications : ADMIN peut envoyer/consulter la supervision ; un enquêteur
--     ne lit que ses notifications.
alter table public.notifications enable row level security;

drop policy if exists notif_sa_read on public.notifications;
drop policy if exists notif_user_read on public.notifications;
drop policy if exists notif_mark_read on public.notifications;
drop policy if exists notif_admin_insert on public.notifications;

create policy notif_sa_read
on public.notifications
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy notif_user_read
on public.notifications
for select to authenticated
using (for_user = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1) or for_user = auth.uid());

create policy notif_mark_read
on public.notifications
for update to authenticated
using (for_user = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1) or for_user = auth.uid())
with check (for_user = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1) or for_user = auth.uid());

create policy notif_admin_insert
on public.notifications
for insert to authenticated
with check (public.is_admin());

-- 11) Communes : lecture pour utilisateurs authentifies ; modification uniquement
--     SUPER ADMIN. L'ADMIN peut consulter toutes les communes.
alter table public.communes enable row level security;

drop policy if exists communes_public_read on public.communes;
drop policy if exists communes_lecture_publique on public.communes;
drop policy if exists communes_sa_write on public.communes;
drop policy if exists communes_staff_read on public.communes;

create policy communes_public_read
on public.communes
for select to anon, authenticated
using (actif = true);

create policy communes_sa_write
on public.communes
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- 12) admin_communes : on ne l'utilise pas pour limiter l'ADMIN central.
--     SUPER ADMIN seulement pour la gestion des affectations historiques.
drop policy if exists admin_communes_select_authenticated on public.admin_communes;
drop policy if exists admin_communes_insert_authenticated on public.admin_communes;
drop policy if exists admin_communes_update_authenticated on public.admin_communes;
drop policy if exists admin_communes_delete_authenticated on public.admin_communes;

create policy admin_communes_sa_all
on public.admin_communes
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- 13) Nettoyage logique : un ADMIN existant devient central et ne garde aucune commune.
update public.profiles
set commune_id = null
where role::text = 'admin';

commit;

-- VERIFICATIONS APRES EXECUTION :
-- select role::text, statut::text, count(*) from public.profiles group by 1,2 order by 1,2;
-- select id, prenom, nom, role::text, statut::text, commune_id from public.profiles order by created_at;
-- select indexname from pg_indexes where tablename='profiles' and indexname like 'uq_profiles_one_%';
