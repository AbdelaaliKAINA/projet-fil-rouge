-- ==========================================================
-- 02_lecture_messages.sql — Accusé de lecture « Vu »
-- À exécuter dans Supabase (SQL Editor) après schema.sql.
-- ==========================================================

-- Date à laquelle le destinataire a lu le message (vide = non lu)
alter table public.messages add column if not exists lu_le timestamptz;

-- La colonne lu_le peut être modifiée (en plus de « reaction »)
grant update (lu_le) on public.messages to authenticated;

-- Seul le destinataire peut marquer un message comme lu
create or replace function public.verifier_lecture()
returns trigger
language plpgsql
as $$
begin
    if new.lu_le is distinct from old.lu_le and auth.uid() <> old.destinataire then
        raise exception 'Seul le destinataire peut marquer un message comme lu';
    end if;
    return new;
end;
$$;

drop trigger if exists avant_lecture on public.messages;
create trigger avant_lecture
    before update on public.messages
    for each row execute function public.verifier_lecture();
