-- FONDS-JOKKO — RLS FINALE DES ROLES
--
-- REGLES METIER :
-- SUPER ADMIN : pouvoir technique global.
-- ADMIN CENTRAL : lecture de toutes les communes/enquetes + commentaires + notifications.
--                Il NE PEUT PAS modifier ni supprimer les enquêtes des enquêteurs.
-- ENQUETEUR : voit/crée/modifie/supprime uniquement SES propres enquêtes.
--              Il reçoit les commentaires/notifications de l'ADMIN.
--
-- IMPORTANT : ce script ne supprime aucune donnée et ne modifie aucun profil existant.
-- Le rattachement commune_id de l'ADMIN/SUPER ADMIN doit rester NULL.

begin;

-- ============================================================
-- FONCTIONS DE ROLE
-- ============================================================

create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where coalesce(p.user_id, p.id) = auth.uid()
  limit 1
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
      and p.role::text = 'super_admin'
      and p.statut::text = 'active'
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
      and p.role::text in ('admin','super_admin')
      and p.statut::text = 'active'
  )
$$;

create or replace function public.is_active_enqueteur()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
      and p.role::text = 'enqueteur'
      and p.statut::text = 'active'
  )
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_active_enqueteur() from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_enqueteur() to authenticated;

-- ============================================================
-- TABLES / RLS
-- ============================================================

alter table public.enquetes enable row level security;
alter table public.commentaires_enquetes enable row level security;
alter table public.notifications enable row level security;
alter table public.communes enable row level security;
alter table public.profiles enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================

-- SUPER ADMIN : gestion complète.
drop policy if exists profiles_sa_all on public.profiles;
create policy profiles_sa_all
on public.profiles for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- ADMIN : lecture de tous les profils.
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read
on public.profiles for select to authenticated
using (public.is_admin());

-- Chaque utilisateur lit son propre profil.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read
on public.profiles for select to authenticated
using (user_id = auth.uid());

-- Un enquêteur peut modifier uniquement les champs personnels autorisés
-- par les autres contrôles applicatifs. Le rôle/statut/commune restent
-- protégés par le trigger guard_profile_update déjà présent.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles for update to authenticated
using (user_id = auth.uid() and role::text = 'enqueteur' and statut::text = 'active')
with check (user_id = auth.uid() and role::text = 'enqueteur' and statut::text = 'active');

-- ============================================================
-- ENQUETES
-- ============================================================

-- Nettoyage des anciennes politiques connues.
drop policy if exists enq_sa_all on public.enquetes;
drop policy if exists enq_admin_read on public.enquetes;
drop policy if exists enq_own_select on public.enquetes;
drop policy if exists enq_own_insert on public.enquetes;
drop policy if exists enq_own_update on public.enquetes;
drop policy if exists enq_own_delete on public.enquetes;

-- SUPER ADMIN : tout.
create policy enq_sa_all
on public.enquetes for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- ADMIN : LECTURE SEULEMENT.
-- Il voit toutes les enquêtes de toutes les communes.
-- Aucune politique UPDATE/DELETE n'est accordée à l'ADMIN.
create policy enq_admin_read
on public.enquetes for select to authenticated
using (public.is_admin());

-- ENQUETEUR : lecture de ses propres enquêtes uniquement.
create policy enq_own_select
on public.enquetes for select to authenticated
using (
  public.is_active_enqueteur()
  and enqueteur_id = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
);

-- ENQUETEUR : création uniquement pour lui-même et sa commune.
create policy enq_own_insert
on public.enquetes for insert to authenticated
with check (
  public.is_active_enqueteur()
  and enqueteur_id = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
  and commune_id = (
    select p.commune_id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
);

-- ENQUETEUR : modification uniquement de ses propres enquêtes.
create policy enq_own_update
on public.enquetes for update to authenticated
using (
  public.is_active_enqueteur()
  and enqueteur_id = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
)
with check (
  public.is_active_enqueteur()
  and enqueteur_id = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
  and commune_id = (
    select p.commune_id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
);

-- ENQUETEUR : suppression uniquement de ses propres enquêtes.
-- C'est l'enquêteur qui exécute la suppression demandée par l'ADMIN.
create policy enq_own_delete
on public.enquetes for delete to authenticated
using (
  public.is_active_enqueteur()
  and enqueteur_id = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
);

-- ============================================================
-- COMMENTAIRES
-- ============================================================

-- ADMIN peut lire tous les commentaires et en créer pour les enquêteurs.
-- Il ne peut pas modifier/supprimer les enquêtes.
drop policy if exists com_sa_all on public.commentaires_enquetes;
drop policy if exists com_admin_read on public.commentaires_enquetes;
drop policy if exists com_admin_insert on public.commentaires_enquetes;
drop policy if exists com_own_read on public.commentaires_enquetes;
drop policy if exists com_own_insert on public.commentaires_enquetes;
drop policy if exists com_own_mark on public.commentaires_enquetes;

create policy com_sa_all
on public.commentaires_enquetes for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy com_admin_read
on public.commentaires_enquetes for select to authenticated
using (public.is_admin());

create policy com_admin_insert
on public.commentaires_enquetes for insert to authenticated
with check (
  public.is_admin()
  and auteur_id = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
  and exists (
    select 1 from public.enquetes e
    where e.id = enquete_id
  )
);

-- ENQUETEUR : lire les commentaires de ses enquêtes.
create policy com_own_read
on public.commentaires_enquetes for select to authenticated
using (
  public.is_active_enqueteur()
  and exists (
    select 1 from public.enquetes e
    where e.id = enquete_id
      and e.enqueteur_id = (
        select p.id from public.profiles p
        where coalesce(p.user_id, p.id) = auth.uid()
        limit 1
      )
  )
);

-- ENQUETEUR : répondre sur ses propres enquêtes.
create policy com_own_insert
on public.commentaires_enquetes for insert to authenticated
with check (
  public.is_active_enqueteur()
  and auteur_id = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
  and exists (
    select 1 from public.enquetes e
    where e.id = enquete_id
      and e.enqueteur_id = (
        select p.id from public.profiles p
        where coalesce(p.user_id, p.id) = auth.uid()
        limit 1
      )
  )
);

-- ENQUETEUR : peut marquer comme lu uniquement les commentaires de ses enquêtes.
create policy com_own_mark
on public.commentaires_enquetes for update to authenticated
using (
  public.is_active_enqueteur()
  and exists (
    select 1 from public.enquetes e
    where e.id = enquete_id
      and e.enqueteur_id = (
        select p.id from public.profiles p
        where coalesce(p.user_id, p.id) = auth.uid()
        limit 1
      )
  )
)
with check (
  public.is_active_enqueteur()
  and exists (
    select 1 from public.enquetes e
    where e.id = enquete_id
      and e.enqueteur_id = (
        select p.id from public.profiles p
        where coalesce(p.user_id, p.id) = auth.uid()
        limit 1
      )
  )
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

-- ADMIN/SUPER ADMIN peuvent consulter les notifications globales.
drop policy if exists notif_sa_read on public.notifications;
drop policy if exists notif_user_read on public.notifications;
drop policy if exists notif_mark_read on public.notifications;
drop policy if exists notif_admin_insert on public.notifications;

create policy notif_sa_read
on public.notifications for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Chaque utilisateur lit uniquement ses notifications.
create policy notif_user_read
on public.notifications for select to authenticated
using (
  for_user = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
  or for_user = auth.uid()
);

-- Marquage lu uniquement pour ses notifications.
create policy notif_mark_read
on public.notifications for update to authenticated
using (
  for_user = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
  or for_user = auth.uid()
)
with check (
  for_user = (
    select p.id from public.profiles p
    where coalesce(p.user_id, p.id) = auth.uid()
    limit 1
  )
  or for_user = auth.uid()
);

-- ADMIN peut envoyer une notification.
-- La cible doit être un enquêteur actif.
create policy notif_admin_insert
on public.notifications for insert to authenticated
with check (
  public.is_admin()
  and (
    for_user = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = for_user
        and p.role::text = 'enqueteur'
        and p.statut::text = 'active'
    )
  )
);

-- ============================================================
-- COMMUNES
-- ============================================================

drop policy if exists communes_public_read on public.communes;
drop policy if exists communes_lecture_publique on public.communes;
drop policy if exists communes_sa_write on public.communes;
drop policy if exists communes_staff_read on public.communes;

-- Lecture des communes actives.
create policy communes_public_read
on public.communes for select to anon, authenticated
using (actif = true);

-- Seul SUPER ADMIN modifie les communes.
create policy communes_sa_write
on public.communes for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

commit;

-- ============================================================
-- VERIFICATIONS APRES EXECUTION
-- ============================================================
-- 1) Roles :
-- select role::text, statut::text, count(*)
-- from public.profiles
-- group by 1,2 order by 1,2;
--
-- 2) Comptes centraux :
-- select prenom, nom, email, role::text, statut::text, commune_id
-- from public.profiles
-- where role::text in ('admin','super_admin');
--
-- 3) Politiques enquêtes :
-- select policyname, cmd, roles from pg_policies
-- where schemaname='public' and tablename='enquetes'
-- order by policyname;


-- ============================================================
-- TRANSFERT AUTOMATIQUE DE L'ADMIN CENTRAL
-- ============================================================
-- Un seul appel depuis l'application suffit pour changer d'ADMIN.
-- L'ancien ADMIN actif devient enquêteur, le nouveau devient ADMIN
-- central actif, sans commune et sans périmètre admin_communes.
-- Aucune donnée d'enquête n'est supprimée.
create or replace function public.transfer_central_admin(
  p_old_admin uuid,
  p_new_admin uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_id uuid;
  new_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Accès réservé au super administrateur';
  end if;

  if p_new_admin is null then
    raise exception 'Le nouvel administrateur est obligatoire';
  end if;

  if p_old_admin is not null and p_old_admin = p_new_admin then
    raise exception 'L ancien et le nouvel administrateur sont identiques';
  end if;

  select id into new_id
  from public.profiles
  where id = p_new_admin
  limit 1;

  if new_id is null then
    raise exception 'Nouveau profil administrateur introuvable';
  end if;

  if p_old_admin is not null then
    select id into old_id
    from public.profiles
    where id = p_old_admin
      and role::text = 'admin'
      and statut::text = 'active'
    limit 1;

    if old_id is not null then
      update public.profiles
      set role = 'enqueteur',
          updated_at = now()
      where id = old_id;
    end if;

    delete from public.admin_communes
    where admin_id = p_old_admin;
  end if;

  update public.profiles
  set role = 'admin',
      statut = 'active',
      commune_id = null,
      approved_at = coalesce(approved_at, now()),
      approved_by = auth.uid(),
      updated_at = now()
  where id = p_new_admin;

  delete from public.admin_communes
  where admin_id = p_new_admin;
end;
$$;

revoke all on function public.transfer_central_admin(uuid, uuid) from public;
grant execute on function public.transfer_central_admin(uuid, uuid) to authenticated;

commit;
