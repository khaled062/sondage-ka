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
create policy "vote si ouvert" on votes for insert to anon
  with check ((select poll_open from settings where id = 1));

-- Admin connecté : lire et supprimer les votes
create policy "admin lit" on votes for select to authenticated using (true);
create policy "admin supprime" on votes for delete to authenticated using (true);

-- Personne ne peut modifier un vote
revoke update on votes from anon, authenticated;

-- Tout le monde voit si le sondage est ouvert ; seul l'admin peut le changer
create policy "lecture etat" on settings for select to anon, authenticated using (true);
create policy "admin ouvre/ferme" on settings for update to authenticated using (true) with check (true);
