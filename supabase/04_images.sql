-- ==========================================================
-- 04_images.sql — Partage d'images dans les conversations
-- À exécuter dans Supabase (SQL Editor) après schema.sql.
-- ==========================================================


-- 1. Colonne « image » : chemin du fichier dans Supabase Storage
--    Format : <id de l'auteur>/<id du destinataire>/<nom unique>.jpg
alter table public.messages add column if not exists image text;

-- Le chemin doit commencer par l'id de l'auteur (on ne peut pas
-- attacher l'image de quelqu'un d'autre)
alter table public.messages drop constraint if exists messages_image_auteur;
alter table public.messages add constraint messages_image_auteur
    check (image is null or image like auteur::text || '/%');

-- Un message peut maintenant être une image sans texte
alter table public.messages drop constraint if exists messages_texte_check;
alter table public.messages add constraint messages_texte_check
    check (
        char_length(texte) <= 1000
        and (char_length(texte) >= 1 or image is not null)
    );


-- 2. Espace de stockage « images » (privé, 5 Mo maximum par image)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 5242880,
        array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;


-- 3. Sécurité des fichiers
-- J'envoie une image seulement dans mon propre dossier
drop policy if exists "images_envoi" on storage.objects;
create policy "images_envoi" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'images'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Je vois une image seulement si j'en suis l'auteur ou le destinataire
drop policy if exists "images_lecture" on storage.objects;
create policy "images_lecture" on storage.objects
    for select to authenticated
    using (
        bucket_id = 'images'
        and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
    );
