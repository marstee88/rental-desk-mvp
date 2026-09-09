-- One project represents one rental business. No demo data is inserted here.
create table public.members (
  user_id uuid primary key references auth.users(id),
  email text not null unique,
  role text not null check (role in ('owner', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index property_name_unique on public.properties(lower(trim(name)));
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  number text not null check (length(trim(number)) between 1 and 50),
  rent_cents integer not null check (rent_cents between 1 and 999999999),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index room_number_unique on public.rooms(property_id, lower(trim(number)));
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  phone text not null check (length(trim(phone)) between 1 and 40),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.tenancies (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  tenant_id uuid not null references public.tenants(id),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  rent_cents integer not null check (rent_cents between 1 and 999999999),
  status text not null default 'active' check (status in ('active')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(room_id),
  unique(tenant_id)
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id),
  month date not null check (extract(day from month) = 1),
  due_cents integer not null check (due_cents between 0 and 999999999),
  paid_cents integer not null check (paid_cents between 0 and due_cents),
  due_date date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(tenancy_id, month)
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  tenant_name text not null,
  move_in date not null,
  deposit_due_cents integer not null check (deposit_due_cents >= 0),
  deposit_paid_cents integer not null check (deposit_paid_cents between 0 and deposit_due_cents)
);
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  partner text not null,
  rooms text not null,
  month date not null,
  collected_cents integer not null check (collected_cents >= 0),
  rent_cost_cents integer not null check (rent_cost_cents >= 0),
  expenses_cents integer not null check (expenses_cents >= 0),
  partner_rate numeric not null check (partner_rate between 0 and 1)
);
-- Never exposed to browsers. Makes retries safe even if the first response is lost.
create table public.operation_requests (
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  kind text not null,
  payload jsonb not null,
  result_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_id)
);

create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = auth.uid() and active)
$$;
create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = auth.uid() and active and role = 'owner')
$$;
revoke all on function public.is_member(), public.is_owner() from public;
grant execute on function public.is_member(), public.is_owner() to authenticated;

alter table public.members enable row level security;
alter table public.properties enable row level security;
alter table public.rooms enable row level security;
alter table public.tenants enable row level security;
alter table public.tenancies enable row level security;
alter table public.invoices enable row level security;
alter table public.bookings enable row level security;
alter table public.investments enable row level security;
alter table public.operation_requests enable row level security;

revoke all on public.members, public.properties, public.rooms, public.tenants, public.tenancies, public.invoices, public.bookings, public.investments, public.operation_requests from anon, authenticated;
grant select on public.members, public.properties, public.rooms, public.tenants, public.tenancies, public.invoices, public.bookings, public.investments to authenticated;
grant all on public.members, public.properties, public.rooms, public.tenants, public.tenancies, public.invoices, public.bookings, public.investments, public.operation_requests to service_role;

create policy member_read on public.members for select to authenticated using (public.is_owner() or (user_id = auth.uid() and active));
create policy property_read on public.properties for select to authenticated using (public.is_member());
create policy room_read on public.rooms for select to authenticated using (public.is_member());
create policy tenant_read on public.tenants for select to authenticated using (public.is_member());
create policy tenancy_read on public.tenancies for select to authenticated using (public.is_member());
create policy invoice_read on public.invoices for select to authenticated using (public.is_member());
create policy booking_read on public.bookings for select to authenticated using (public.is_member());
create policy investment_read on public.investments for select to authenticated using (public.is_owner());

create function public.add_room(p_property_id uuid, p_property_name text, p_number text, p_rent_cents integer, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_property uuid := p_property_id;
  v_room uuid;
  v_request public.operation_requests;
  v_payload jsonb := jsonb_build_array(p_property_id, trim(p_property_name), trim(p_number), p_rent_cents);
begin
  if not public.is_member() then raise exception '账号尚未获授权或已停用。' using errcode = '42501'; end if;
  if p_request_id is null then raise exception '缺少提交编号，请重新打开表单。'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_request_id::text, 0));
  select * into v_request from public.operation_requests where user_id = auth.uid() and request_id = p_request_id;
  if found then
    if v_request.kind <> 'room' or v_request.payload <> v_payload then raise exception '该提交已保存，请刷新列表后重新新增。'; end if;
    return v_request.result_id;
  end if;
  if p_property_id is null then
    insert into public.properties(name, created_by) values (trim(p_property_name), auth.uid()) returning id into v_property;
  end if;
  insert into public.rooms(property_id, number, rent_cents, created_by)
    values(v_property, trim(p_number), p_rent_cents, auth.uid()) returning id into v_room;
  insert into public.operation_requests(user_id, request_id, kind, payload, result_id)
    values(auth.uid(), p_request_id, 'room', v_payload, v_room);
  return v_room;
exception when unique_violation then
  raise exception '该房源名称或房号已存在，请选择已有房源并检查房号。' using errcode = '23505';
end;
$$;

create function public.register_tenant(p_room_id uuid, p_name text, p_phone text, p_start_date date, p_end_date date, p_rent_cents integer, p_due_cents integer, p_paid_cents integer, p_due_date date, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
  v_tenancy uuid;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_request public.operation_requests;
  v_payload jsonb := jsonb_build_array(p_room_id, trim(p_name), trim(p_phone), p_start_date, p_end_date, p_rent_cents, p_due_cents, p_paid_cents, p_due_date);
begin
  if not public.is_member() then raise exception '账号尚未获授权或已停用。' using errcode = '42501'; end if;
  if p_request_id is null then raise exception '缺少提交编号，请重新打开表单。'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_request_id::text, 0));
  select * into v_request from public.operation_requests where user_id = auth.uid() and request_id = p_request_id;
  if found then
    if v_request.kind <> 'tenant' or v_request.payload <> v_payload then raise exception '该提交已保存，请刷新列表后重新新增。'; end if;
    return v_request.result_id;
  end if;
  if p_start_date > v_today then raise exception '此表登记已入住租客，入住日期不能晚于今天。'; end if;
  if p_end_date < v_today or p_end_date < p_start_date then raise exception '合约到期日不得早于入住日期或今天。'; end if;
  -- Serializes competing registrations; uniqueness remains a second defence.
  perform 1 from public.rooms where id = p_room_id for update;
  if not found then raise exception '找不到该房间，请刷新列表。'; end if;
  if exists(select 1 from public.tenancies where room_id = p_room_id) then
    raise exception '该房间已被安排入住，请刷新后选择其他空房。' using errcode = 'P0001';
  end if;
  insert into public.tenants(name, phone, created_by) values(trim(p_name), trim(p_phone), auth.uid()) returning id into v_tenant;
  insert into public.tenancies(room_id, tenant_id, start_date, end_date, rent_cents, created_by)
    values(p_room_id, v_tenant, p_start_date, p_end_date, p_rent_cents, auth.uid()) returning id into v_tenancy;
  insert into public.invoices(tenancy_id, month, due_cents, paid_cents, due_date, created_by)
    values(v_tenancy, date_trunc('month', p_due_date)::date, p_due_cents, p_paid_cents, p_due_date, auth.uid());
  insert into public.operation_requests(user_id, request_id, kind, payload, result_id)
    values(auth.uid(), p_request_id, 'tenant', v_payload, v_tenancy);
  return v_tenancy;
end;
$$;

create function public.set_staff_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '仅管理员可以管理员工。' using errcode = '42501'; end if;
  update public.members set active = p_active where user_id = p_user_id and role = 'staff';
  if not found then raise exception '找不到该员工，管理员账号不能在此停用。'; end if;
end;
$$;
revoke all on function public.add_room(uuid,text,text,integer,uuid), public.register_tenant(uuid,text,text,date,date,integer,integer,integer,date,uuid), public.set_staff_active(uuid,boolean) from public, anon;
grant execute on function public.add_room(uuid,text,text,integer,uuid), public.register_tenant(uuid,text,text,date,date,integer,integer,integer,date,uuid), public.set_staff_active(uuid,boolean) to authenticated;
