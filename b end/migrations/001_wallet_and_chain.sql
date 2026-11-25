-- Prepare separately and review before applying to Supabase.
-- These tables are isolated from existing bookings and payments.
begin;
create table if not exists public.wallet_links (
  user_id uuid primary key references public.users(id) on delete cascade,
  address text not null unique check (address ~ '^0x[0-9a-f]{40}$'),
  chain_id bigint not null check (chain_id = 11155111),
  linked_at timestamptz not null default now()
);
create table if not exists public.wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'),
  message text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wallet_challenges_user_created_idx on public.wallet_challenges(user_id, created_at desc);

-- References only; never use this table as a source of truth for chain state.
-- A trusted indexer must verify chain receipts and handle confirmations and reorgs.
create table if not exists public.chain_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  chain_id bigint not null check (chain_id = 11155111),
  contract_address text not null check (contract_address ~ '^0x[0-9a-f]{40}$'),
  chain_booking_id numeric(78,0) not null check (chain_booking_id > 0),
  customer_wallet text not null check (customer_wallet ~ '^0x[0-9a-f]{40}$'),
  created_tx_hash text not null check (created_tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (chain_id, contract_address, chain_booking_id),
  unique (chain_id, created_tx_hash)
);

alter table public.wallet_links enable row level security;
alter table public.wallet_challenges enable row level security;
alter table public.chain_bookings enable row level security;
revoke all on public.wallet_links, public.wallet_challenges, public.chain_bookings from anon, authenticated;
grant select, insert, update, delete on public.wallet_links, public.wallet_challenges, public.chain_bookings to service_role;

-- Consume and link in one transaction, after the server verifies the SIWE signature.
create or replace function public.consume_wallet_challenge(p_id uuid, p_user_id uuid, p_address text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare challenge_id uuid;
begin
  update public.wallet_challenges set consumed_at = now()
  where id = p_id and user_id = p_user_id and address = p_address
    and consumed_at is null and expires_at > now()
  returning id into challenge_id;
  if challenge_id is null then return false; end if;
  insert into public.wallet_links(user_id, address, chain_id)
    values (p_user_id, p_address, 11155111)
    on conflict (user_id) do update set address = excluded.address, chain_id = excluded.chain_id, linked_at = now();
  return true;
end;
$$;
revoke all on function public.consume_wallet_challenge(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_wallet_challenge(uuid, uuid, text) to service_role;
commit;
