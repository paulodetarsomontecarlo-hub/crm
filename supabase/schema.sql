-- Esquema do m4t CRM no Supabase (Postgres).
-- Rode este arquivo inteiro em: Supabase > SQL Editor > New query > Run.
-- Pode rodar de novo sem problema (IF NOT EXISTS / DROP POLICY IF EXISTS).

create table if not exists estagios (
  id text primary key,
  label text not null,
  ordem integer not null
);

create table if not exists contacts (
  id text primary key,
  nome text not null,
  empresa text,
  email text,
  telefone text,
  notas text,
  criado_em timestamptz not null default now()
);

create table if not exists deals (
  id text primary key,
  titulo text not null,
  valor integer not null default 0,
  estagio_id text not null references estagios(id) on delete restrict,
  contato_id text references contacts(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  titulo text not null,
  vencimento date,
  concluida boolean not null default false,
  contato_id text references contacts(id) on delete set null,
  deal_id text references deals(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Estágios padrão, só na primeira vez (não sobrescreve se você já editou).
insert into estagios (id, label, ordem) values
  ('lead', 'Lead', 0),
  ('proposta', 'Proposta', 1),
  ('negociacao', 'Negociação', 2),
  ('ganho', 'Ganho', 3),
  ('perdido', 'Perdido', 4)
on conflict (id) do nothing;

-- RLS (Row Level Security): o app usa a chave "anon" pública do Supabase
-- diretamente do navegador (é assim que o Supabase é feito para funcionar
-- em apps 100% front-end). Isso NÃO é autenticação de verdade — é o mesmo
-- nível de proteção que o app já tinha (tela de login só de trava de
-- acesso visual). Qualquer pessoa com a URL do projeto e a anon key
-- consegue ler/escrever essas tabelas. Não guarde aqui nada sensível de
-- verdade; se isso virar um problema, o próximo passo é trocar para
-- Supabase Auth de verdade com policies por usuário.
alter table estagios enable row level security;
alter table contacts enable row level security;
alter table deals enable row level security;
alter table tasks enable row level security;

drop policy if exists "acesso total anon" on estagios;
create policy "acesso total anon" on estagios for all using (true) with check (true);

drop policy if exists "acesso total anon" on contacts;
create policy "acesso total anon" on contacts for all using (true) with check (true);

drop policy if exists "acesso total anon" on deals;
create policy "acesso total anon" on deals for all using (true) with check (true);

drop policy if exists "acesso total anon" on tasks;
create policy "acesso total anon" on tasks for all using (true) with check (true);
