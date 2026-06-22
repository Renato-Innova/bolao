create table if not exists artilheiros_copa (
  id            integer primary key,  -- player id da football-data.org
  jogador       text    not null,
  seleção       text    not null,
  escudo_url    text,
  gols          integer not null default 0,
  assistencias  integer not null default 0,
  penaltis      integer not null default 0,
  jogos         integer not null default 0,
  atualizado_em timestamptz not null default now()
);

alter table artilheiros_copa enable row level security;

create policy "artilheiros_select_public"
  on artilheiros_copa for select
  using (true);
