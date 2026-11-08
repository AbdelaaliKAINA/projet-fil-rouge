-- ==========================================================
-- 03_suppression_messages.sql — Supprimer ses propres messages
-- À exécuter dans Supabase (SQL Editor) après schema.sql.
-- ==========================================================

-- Chacun peut supprimer uniquement les messages qu'il a écrits
drop policy if exists "messages_suppression" on public.messages;
create policy "messages_suppression" on public.messages
    for delete to authenticated
    using (auteur = auth.uid());

grant delete on public.messages to authenticated;
