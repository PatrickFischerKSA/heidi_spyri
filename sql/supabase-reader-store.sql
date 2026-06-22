create table if not exists public.reader_store (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.reader_store enable row level security;
