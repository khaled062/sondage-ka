-- Boîte à questions anonyme (FAQ). À coller dans Supabase : SQL Editor → New query → Run.
-- Les visiteurs peuvent seulement envoyer ; seul l'admin connecté lit et supprime.

create table questions (
  id uuid primary key default gen_random_uuid(),
  texte text not null check (char_length(btrim(texte)) between 1 and 1000),
  navigateur text check (char_length(navigateur) <= 64), -- identifiant tiré au hasard, gardé dans le navigateur
  empreinte text,                                         -- empreinte brouillée de l'IP (jamais l'IP en clair)
  created_at timestamptz not null default now()
);
alter table questions enable row level security;

-- Sel secret pour brouiller les IP : table sans aucune règle d'accès, donc illisible depuis le site.
create table sel_secret (id int primary key default 1 check (id = 1), sel text not null);
insert into sel_secret (sel) values (encode(extensions.gen_random_bytes(32), 'hex'));
alter table sel_secret enable row level security;

-- À l'envoi : calcule l'empreinte de l'IP du visiteur (on peut comparer deux empreintes, pas retrouver l'IP).
create or replace function questions_empreinte() returns trigger
  language plpgsql security definer set search_path = public, extensions
  as $$
declare
  entetes json := nullif(current_setting('request.headers', true), '')::json;
  ip text := coalesce(entetes->>'cf-connecting-ip', split_part(entetes->>'x-forwarded-for', ',', 1), '');
begin
  new.empreinte := case when ip = '' then null
    else left(encode(digest(ip || (select sel from sel_secret where id = 1), 'sha256'), 'hex'), 16) end;
  new.created_at := now();
  return new;
end $$;
create trigger questions_empreinte before insert on questions for each row execute function questions_empreinte();

create policy "envoyer une question" on questions for insert to anon, authenticated with check (true); -- authenticated : l'admin connecté peut aussi envoyer
create policy "admin lit les questions" on questions for select to authenticated using (true);
create policy "admin supprime les questions" on questions for delete to authenticated using (true);
revoke update on questions from anon, authenticated;
