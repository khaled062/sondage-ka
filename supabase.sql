-- À coller dans Supabase : SQL Editor → New query → coller → Run.

-- Votes : un classement par ligne, anonyme
create table votes (
  id uuid primary key,              -- créé par le navigateur : un double envoi = même id = refusé
  ranking jsonb not null check (jsonb_typeof(ranking) = 'array' and jsonb_array_length(ranking) between 1 and 500),
  created_at timestamptz not null default now()
);

-- Réglages : une seule ligne
create table settings (
  id int primary key default 1 check (id = 1),
  poll_open boolean not null default true
);
insert into settings default values;

alter table votes enable row level security;
alter table settings enable row level security;

-- Visiteurs : peuvent seulement ajouter un vote, et seulement si le sondage est ouvert
create policy "vote si ouvert" on votes for insert to anon, authenticated -- l'admin connecté peut aussi voter
  with check ((select poll_open from settings where id = 1));

-- Admin connecté : lire et supprimer les votes
create policy "admin lit" on votes for select to authenticated using (true);
create policy "admin supprime" on votes for delete to authenticated using (true);

-- Personne ne peut modifier un vote
revoke update on votes from anon, authenticated;

-- Tout le monde voit si le sondage est ouvert ; seul l'admin peut le changer
create policy "lecture etat" on settings for select to anon, authenticated using (true);
create policy "admin ouvre/ferme" on settings for update to authenticated using (true) with check (true);

-- Le navigateur d'un votant demande si SON vote existe encore (supprimé dans l'admin = il peut revoter).
-- Ne révèle rien d'autre : il faut connaître l'identifiant secret du vote.
create or replace function vote_existe(vid uuid) returns boolean
  language sql security definer set search_path = public
  as $$ select exists (select 1 from votes where id = vid) $$;
revoke execute on function vote_existe(uuid) from public;
grant execute on function vote_existe(uuid) to anon, authenticated;
