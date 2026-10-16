-- Paso 12.3.3 — Reserva atómica de cuota CitoAPI con margen de seguridad.

create or replace function public.try_bump_source_quota(
  p_source text,
  p_period date,
  p_by integer,
  p_limit integer
) returns integer language plpgsql as $$
declare
  reserved_calls integer;
begin
  if p_by < 1 or p_limit < 1 or p_by > p_limit then
    raise exception 'Invalid quota reservation';
  end if;

  insert into public.source_quota_usage (source, period_start, calls)
  values (p_source, p_period, p_by)
  on conflict (source, period_start)
  do update set calls = public.source_quota_usage.calls + excluded.calls
  where public.source_quota_usage.calls + excluded.calls <= p_limit
  returning calls into reserved_calls;

  return reserved_calls;
end;
$$;

revoke all on function public.try_bump_source_quota(text, date, integer, integer) from public, anon, authenticated;
grant execute on function public.try_bump_source_quota(text, date, integer, integer) to service_role;