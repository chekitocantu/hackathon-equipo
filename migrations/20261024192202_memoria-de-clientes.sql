-- Memoria del Traductor: lo que se dijo en cada llamada, para no volver a preguntarlo
-- y para mostrar en vivo qué compraron clientes parecidos.
-- Solo el servidor de la app (landing/server) lee y escribe, con la API key de administrador.
-- Por eso RLS está activo y sin políticas: con la anon key nadie puede leer conversaciones de clientes.

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  -- Nombre en minúsculas y sin espacios extra, para reconocer al cliente aunque lo escriban distinto.
  clave text not null unique,
  empresa text not null,
  industria text,
  ciudad text,
  empleados integer,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table public.llamadas (
  id uuid primary key,
  cliente_id uuid references public.clientes (id) on delete set null,
  -- meet | demo | pestaña | historial (los 10 casos del catálogo cargados como llamadas pasadas)
  origen text not null,
  codigo text,
  inicio timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table public.segmentos (
  id bigint generated always as identity primary key,
  llamada_id uuid not null references public.llamadas (id) on delete cascade,
  orden integer not null,
  quien text not null,
  texto text not null,
  creado timestamptz not null default now(),
  unique (llamada_id, orden)
);

-- Un dato por cliente y etiqueta ("Usuarios", "TB a respaldar"...): el más reciente gana.
create table public.datos_cliente (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  llamada_id uuid references public.llamadas (id) on delete set null,
  etiqueta text not null,
  valor text not null,
  actualizado timestamptz not null default now(),
  unique (cliente_id, etiqueta)
);

-- Un producto del catálogo por cliente; el estado es el último que dio el agente.
create table public.productos_cliente (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  llamada_id uuid references public.llamadas (id) on delete set null,
  sku text not null,
  estado text not null,
  cantidad integer,
  actualizado timestamptz not null default now(),
  unique (cliente_id, sku)
);

create index on public.clientes (industria);
create index on public.llamadas (cliente_id);
create index on public.productos_cliente (sku);

alter table public.clientes enable row level security;
alter table public.llamadas enable row level security;
alter table public.segmentos enable row level security;
alter table public.datos_cliente enable row level security;
alter table public.productos_cliente enable row level security;

revoke all on public.clientes, public.llamadas, public.segmentos, public.datos_cliente, public.productos_cliente from anon, authenticated;
