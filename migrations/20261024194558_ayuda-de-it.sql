-- Algoritmo de ayuda de IT (landing/server/ayuda.ts): las preguntas de cada llamada, cuáles son técnicas,
-- y la decisión de si entra un ingeniero y para qué. Mismo acceso que la memoria: solo el servidor, RLS sin políticas.

create table public.preguntas_llamada (
  id bigint generated always as identity primary key,
  llamada_id uuid not null references public.llamadas (id) on delete cascade,
  -- cliente: la hizo el cliente · agente: el Traductor se la sugirió al vendedor
  origen text not null check (origen in ('cliente', 'agente')),
  texto text not null,
  -- Texto normalizado para no contar dos veces la misma pregunta.
  clave text not null,
  tecnica boolean not null,
  termino text,
  creado timestamptz not null default now(),
  unique (llamada_id, clave)
);

-- La última decisión de cada llamada.
create table public.ayuda_it (
  llamada_id uuid primary key references public.llamadas (id) on delete cascade,
  tipo_caso text not null check (tipo_caso in ('estándar', 'mixto', 'a la medida', 'por definir')),
  nivel text not null check (nivel in ('no', 'consulta', 'acompaña')),
  tecnicas integer not null,
  total integer not null,
  entra jsonb not null default '[]',
  no_entra jsonb not null default '[]',
  actualizado timestamptz not null default now()
);

alter table public.preguntas_llamada enable row level security;
alter table public.ayuda_it enable row level security;
revoke all on public.preguntas_llamada, public.ayuda_it from anon, authenticated;
