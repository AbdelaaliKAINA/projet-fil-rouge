-- ==========================================================
-- schema.sql — Base de données de Ma Messagerie (Supabase)
-- ----------------------------------------------------------
-- À exécuter UNE fois dans Supabase : SQL Editor > New query,
-- coller tout le fichier, puis cliquer sur « Run ».
-- Le script peut être relancé sans perdre de données.
-- ==========================================================


-- ----------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------

-- Profil public de chaque personne inscrite
-- (une ligne par compte Supabase Auth)
create table if not exists public.profils (
    id       uuid primary key references auth.users (id) on delete cascade,
    nom      text not null check (char_length(nom) between 1 and 40),
    courriel text not null unique,
    cree_le  timestamptz not null default now()
);

-- Relations entre deux personnes :
-- « en_attente » = invitation envoyée, « accepte » = contacts
create table if not exists public.contacts (
    id           bigint generated always as identity primary key,
    demandeur    uuid not null,
    destinataire uuid not null,
    statut       text not null default 'en_attente'
                 check (statut in ('en_attente', 'accepte')),
    cree_le      timestamptz not null default now(),

    constraint contacts_demandeur_fkey
        foreign key (demandeur) references public.profils (id) on delete cascade,
    constraint contacts_destinataire_fkey
        foreign key (destinataire) references public.profils (id) on delete cascade,

    -- On ne peut pas s'inviter soi-même
    constraint contacts_personnes_differentes check (demandeur <> destinataire)
);

-- Une seule relation par paire de personnes, peu importe qui a invité
create unique index if not exists contacts_paire_unique
    on public.contacts (least(demandeur, destinataire), greatest(demandeur, destinataire));

-- Messages échangés entre deux contacts
create table if not exists public.messages (
    id           bigint generated always as identity primary key,
    auteur       uuid not null references public.profils (id) on delete cascade,
    destinataire uuid not null references public.profils (id) on delete cascade,
    texte        text not null check (char_length(texte) between 1 and 1000),
    reaction     text check (reaction in ('👍', '❤️', '😂')),   -- fonctionnalité supplémentaire
    cree_le      timestamptz not null default now()               -- horodatage
);

create index if not exists messages_auteur_idx on public.messages (auteur);
create index if not exists messages_destinataire_idx on public.messages (destinataire);


-- ----------------------------------------------------------
-- 2. CRÉATION AUTOMATIQUE DU PROFIL À L'INSCRIPTION
-- ----------------------------------------------------------

create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.profils (id, nom, courriel)
    values (
        new.id,
        -- Nom saisi à l'inscription, sinon la partie avant le @
        left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nom'), ''),
                      split_part(new.email, '@', 1)), 40),
        lower(new.email)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists apres_inscription on auth.users;
create trigger apres_inscription
    after insert on auth.users
    for each row execute function public.creer_profil();

-- Crée le profil des comptes qui existaient avant ce script
insert into public.profils (id, nom, courriel)
select id, left(split_part(email, '@', 1), 40), lower(email)
from auth.users
where email is not null
on conflict do nothing;


-- ----------------------------------------------------------
-- 3. FONCTIONS APPELÉES PAR LE SITE
-- ----------------------------------------------------------

-- Trouve une personne par son courriel exact (pour l'inviter)
-- sans rendre visible la liste de tous les inscrits
create or replace function public.trouver_profil(p_courriel text)
returns table (id uuid, nom text)
language sql
stable
security definer set search_path = ''
as $$
    select p.id, p.nom
    from public.profils p
    where p.courriel = lower(trim(p_courriel))
      and auth.uid() is not null;
$$;

-- Supprime le compte de la personne connectée
-- (le profil, les contacts et les messages sont supprimés en cascade)
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
    delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.trouver_profil(text) from public, anon;
revoke execute on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.trouver_profil(text) to authenticated;
grant execute on function public.supprimer_mon_compte() to authenticated;


-- ----------------------------------------------------------
-- 4. SÉCURITÉ : ROW LEVEL SECURITY (RLS)
-- Chaque personne ne voit et ne modifie que ses propres données.
-- ----------------------------------------------------------

alter table public.profils  enable row level security;
alter table public.contacts enable row level security;
alter table public.messages enable row level security;

-- ----- Profils -----
-- Je vois mon profil et celui des personnes liées à moi
drop policy if exists "profils_lecture" on public.profils;
create policy "profils_lecture" on public.profils
    for select to authenticated
    using (
        id = auth.uid()
        or exists (
            select 1 from public.contacts c
            where (c.demandeur = auth.uid() and c.destinataire = profils.id)
               or (c.destinataire = auth.uid() and c.demandeur = profils.id)
        )
    );

-- Je peux modifier uniquement mon nom
drop policy if exists "profils_modification" on public.profils;
create policy "profils_modification" on public.profils
    for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

revoke insert, update, delete on public.profils from anon, authenticated;
grant update (nom) on public.profils to authenticated;

-- ----- Contacts -----
-- Je vois les relations dont je fais partie
drop policy if exists "contacts_lecture" on public.contacts;
create policy "contacts_lecture" on public.contacts
    for select to authenticated
    using (auth.uid() in (demandeur, destinataire));

-- J'envoie une invitation en mon nom, toujours « en attente »
drop policy if exists "contacts_invitation" on public.contacts;
create policy "contacts_invitation" on public.contacts
    for insert to authenticated
    with check (demandeur = auth.uid() and statut = 'en_attente');

-- Seul le destinataire peut accepter une invitation
drop policy if exists "contacts_acceptation" on public.contacts;
create policy "contacts_acceptation" on public.contacts
    for update to authenticated
    using (destinataire = auth.uid() and statut = 'en_attente')
    with check (destinataire = auth.uid() and statut = 'accepte');

-- Refuser, annuler ou supprimer une relation dont je fais partie
drop policy if exists "contacts_suppression" on public.contacts;
create policy "contacts_suppression" on public.contacts
    for delete to authenticated
    using (auth.uid() in (demandeur, destinataire));

revoke update on public.contacts from anon, authenticated;
grant update (statut) on public.contacts to authenticated;

-- ----- Messages -----
-- Je vois les messages que j'ai envoyés ou reçus
drop policy if exists "messages_lecture" on public.messages;
create policy "messages_lecture" on public.messages
    for select to authenticated
    using (auth.uid() in (auteur, destinataire));

-- J'écris en mon nom, et seulement à un contact accepté
drop policy if exists "messages_envoi" on public.messages;
create policy "messages_envoi" on public.messages
    for insert to authenticated
    with check (
        messages.auteur = auth.uid()
        and exists (
            select 1 from public.contacts c
            where c.statut = 'accepte'
              and ((c.demandeur = messages.auteur and c.destinataire = messages.destinataire)
                or (c.demandeur = messages.destinataire and c.destinataire = messages.auteur))
        )
    );

-- Les deux personnes de la conversation peuvent réagir
drop policy if exists "messages_reaction" on public.messages;
create policy "messages_reaction" on public.messages
    for update to authenticated
    using (auth.uid() in (auteur, destinataire))
    with check (auth.uid() in (auteur, destinataire));

-- Seule la colonne « reaction » peut être modifiée
revoke update, delete on public.messages from anon, authenticated;
grant update (reaction) on public.messages to authenticated;

-- Les visiteurs non connectés n'ont accès à rien
revoke all on public.profils, public.contacts, public.messages from anon;


-- ----------------------------------------------------------
-- 5. TEMPS RÉEL
-- Les pages reçoivent les nouveaux messages et invitations
-- sans être rechargées.
-- ----------------------------------------------------------

do $$
begin
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'messages') then
        alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'contacts') then
        alter publication supabase_realtime add table public.contacts;
    end if;
end;
$$;
