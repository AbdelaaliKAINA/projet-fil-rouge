-- ==========================================================
-- 05_salons.sql — Salons de discussion de groupe
-- À exécuter dans Supabase (SQL Editor) après schema.sql.
-- Un salon est public : toute personne connectée le voit,
-- peut y écrire et peut créer un nouveau salon.
-- ==========================================================


-- 1. TABLES

-- Salons (nom unique, sans tenir compte des majuscules)
create table if not exists public.salons (
    id        bigint generated always as identity primary key,
    nom       text not null check (char_length(trim(nom)) between 1 and 50),
    cree_par  uuid default auth.uid() references public.profils (id) on delete set null,
    cree_le   timestamptz not null default now()
);

create unique index if not exists salons_nom_unique
    on public.salons (lower(trim(nom)));

-- Messages des salons
-- nom_auteur est rempli par la base (trigger) : le navigateur
-- ne peut pas écrire un faux nom
create table if not exists public.messages_salon (
    id          bigint generated always as identity primary key,
    salon_id    bigint not null references public.salons (id) on delete cascade,
    auteur      uuid default auth.uid() references public.profils (id) on delete set null,
    nom_auteur  text not null default '',
    texte       text not null check (char_length(trim(texte)) between 1 and 1000),
    cree_le     timestamptz not null default now()
);

create index if not exists messages_salon_salon_idx
    on public.messages_salon (salon_id, cree_le);


-- 2. NOM DE L'AUTEUR REMPLI AUTOMATIQUEMENT

create or replace function public.remplir_nom_auteur()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    new.nom_auteur := (select p.nom from public.profils p where p.id = new.auteur);
    return new;
end;
$$;

drop trigger if exists avant_message_salon on public.messages_salon;
create trigger avant_message_salon
    before insert on public.messages_salon
    for each row execute function public.remplir_nom_auteur();


-- 3. SÉCURITÉ (RLS)

alter table public.salons         enable row level security;
alter table public.messages_salon enable row level security;

-- Lecture : toute personne connectée voit tous les salons et leurs messages
drop policy if exists "salons_lecture" on public.salons;
create policy "salons_lecture" on public.salons
    for select to authenticated using (true);

drop policy if exists "messages_salon_lecture" on public.messages_salon;
create policy "messages_salon_lecture" on public.messages_salon
    for select to authenticated using (true);

-- Création : seulement en son propre nom
drop policy if exists "salons_creation" on public.salons;
create policy "salons_creation" on public.salons
    for insert to authenticated with check (cree_par = auth.uid());

drop policy if exists "messages_salon_envoi" on public.messages_salon;
create policy "messages_salon_envoi" on public.messages_salon
    for insert to authenticated with check (auteur = auth.uid());

-- Suppression : seul le créateur peut supprimer son salon
drop policy if exists "salons_suppression" on public.salons;
create policy "salons_suppression" on public.salons
    for delete to authenticated using (cree_par = auth.uid());

-- Aucune modification possible après l'envoi
revoke update on public.salons, public.messages_salon from anon, authenticated;
revoke all on public.salons, public.messages_salon from anon;


-- 4. TEMPS RÉEL

do $$
begin
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'salons') then
        alter publication supabase_realtime add table public.salons;
    end if;

    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'messages_salon') then
        alter publication supabase_realtime add table public.messages_salon;
    end if;
end;
$$;
