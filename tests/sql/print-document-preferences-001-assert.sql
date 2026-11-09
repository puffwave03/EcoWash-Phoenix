-- PREPARED, NOT EXECUTED. Requires the dedicated setup and both reviewed migrations.
-- All assertions and fixture writes roll back. Never target staging/production/labs.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_database() <> 'phoenix_print_document_preferences_test' or inet_server_addr() is not null then
    raise exception 'dedicated local Unix-socket test database required';
  end if;
  if has_table_privilege('authenticated','public.document_print_preferences','INSERT')
    or has_table_privilege('authenticated','public.document_print_preferences','UPDATE')
    or has_table_privilege('authenticated','public.document_print_preferences','DELETE')
    or has_function_privilege('anon','public.save_document_print_preference(uuid,text,text,uuid)','EXECUTE') then
    raise exception 'least privilege failed';
  end if;
end $$;
-- Full pre-migration rows, including default/label settings, remain byte-equivalent JSON.
do $$ begin
  if (select count(*) from public.printer_profiles) <> 4 or exists (
    select 1 from public.fixture_original_printer_profiles original
    left join public.printer_profiles profile using(id)
    where to_jsonb(profile) is distinct from original.snapshot
  ) then raise exception 'existing profile rows changed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare first_id uuid; saved_id uuid; fmt text; begin
  -- No profile required; unique upsert for all three supported formats.
  foreach fmt in array array['a4','58mm','80mm'] loop
    saved_id := public.save_document_print_preference('20000000-0000-4000-8000-000000000001','customer-copy',fmt,null);
    if first_id is not null and first_id <> saved_id then raise exception 'upsert created another preference'; end if;
    first_id := saved_id;
    if not exists (select 1 from public.document_print_preferences where id=saved_id and paper_format=fmt
      and created_by=auth.uid() and updated_by=auth.uid()) then raise exception 'format or actor not persisted'; end if;
  end loop;
  perform public.save_document_print_preference('20000000-0000-4000-8000-000000000002','customer-copy','a4',null);
  if (select count(*) from public.document_print_preferences) <> 2 then raise exception 'site independence failed'; end if;
end $$;
-- Reject invalid/unsupported documents, format, foreign site, mismatched profile.
do $$ declare args text[]; begin
  foreach args slice 1 in array array[
    array['20000000-0000-4000-8000-000000000001','ticket','a4',null],
    array['20000000-0000-4000-8000-000000000001','customer-copy','bad',null],
    array['20000000-0000-4000-8000-000000000003','customer-copy','a4',null],
    array['20000000-0000-4000-8000-000000000002','customer-copy','58mm','30000000-0000-4000-8000-000000000001'],
    array['20000000-0000-4000-8000-000000000001','customer-copy','58mm','30000000-0000-4000-8000-000000000002'],
    array['20000000-0000-4000-8000-000000000001','customer-copy','58mm','30000000-0000-4000-8000-000000000003']
  ] loop
    begin
      perform public.save_document_print_preference(args[1]::uuid,args[2],args[3],args[4]::uuid);
      raise exception 'invalid preference accepted: %',args;
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    update public.document_print_preferences set paper_format='80mm';
    raise exception 'direct client write accepted';
  exception when insufficient_privilege then null; end;
end $$;
-- Manager is an existing authorized printer-settings role.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.save_document_print_preference('20000000-0000-4000-8000-000000000001','customer-copy','58mm','30000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
  perform public.save_document_print_preference('20000000-0000-4000-8000-000000000001','customer-copy','a4',null);
  raise exception 'staff write accepted';
exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  perform public.save_document_print_preference('20000000-0000-4000-8000-000000000001','customer-copy','a4',null);
  raise exception 'missing actor accepted';
exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
do $$ begin
  if exists (select 1 from public.document_print_preferences) then raise exception 'RLS exposed another tenant'; end if;
end $$;
select public.save_document_print_preference('20000000-0000-4000-8000-000000000003','customer-copy','80mm',null);
reset role;
-- Structural constraints also reject bad privileged writes (RLS alone is insufficient).
do $$ begin
  begin
    insert into public.document_print_preferences(organization_id,location_id,document_type,paper_format)
      values('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','customer-copy','a4');
    raise exception 'cross-tenant location accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.document_print_preferences set printer_profile_id='30000000-0000-4000-8000-000000000003'
      where organization_id='00000000-0000-4000-8000-000000000001' and location_id='20000000-0000-4000-8000-000000000001';
    raise exception 'cross-tenant profile accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.document_print_preferences set paper_format='unknown';
    raise exception 'invalid format accepted';
  exception when check_violation then null; end;
  begin
    insert into public.document_print_preferences(organization_id,location_id,document_type,paper_format)
      values('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','customer-copy','a4');
    raise exception 'duplicate scope accepted';
  exception when unique_violation then null; end;
end $$;
-- Disabled profile loses only its optional association, not the preference format.
update public.printer_profiles set enabled=false where id='30000000-0000-4000-8000-000000000001';
do $$ begin
  if not exists(select 1 from public.document_print_preferences where location_id='20000000-0000-4000-8000-000000000001'
    and printer_profile_id is null and paper_format='58mm') then raise exception 'disable failed to detach'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
  perform public.save_document_print_preference('20000000-0000-4000-8000-000000000001','customer-copy','58mm','30000000-0000-4000-8000-000000000001');
  raise exception 'disabled profile accepted';
exception when invalid_parameter_value then null; end $$;
reset role;
-- Moving or reformatting profiles preserves the existing profile editor.
update public.printer_profiles set enabled=true where id='30000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.save_document_print_preference('20000000-0000-4000-8000-000000000001','customer-copy','58mm','30000000-0000-4000-8000-000000000001');
reset role;
update public.printer_profiles set location_id='20000000-0000-4000-8000-000000000002' where id='30000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from public.document_print_preferences where printer_profile_id='30000000-0000-4000-8000-000000000001') then raise exception 'move failed to detach'; end if;
end $$;
set local role authenticated;
select public.save_document_print_preference('20000000-0000-4000-8000-000000000002','customer-copy','58mm','30000000-0000-4000-8000-000000000001');
reset role;
update public.printer_profiles set paper_format='receipt_80mm' where id='30000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from public.document_print_preferences where printer_profile_id='30000000-0000-4000-8000-000000000001') then raise exception 'format change failed to detach'; end if;
end $$;
set local role authenticated;
select public.save_document_print_preference('20000000-0000-4000-8000-000000000002','customer-copy','80mm','30000000-0000-4000-8000-000000000001');
reset role;
delete from public.printer_profiles where id='30000000-0000-4000-8000-000000000001';
do $$ begin
  if not exists(select 1 from public.document_print_preferences where location_id='20000000-0000-4000-8000-000000000002'
    and printer_profile_id is null and paper_format='80mm') then raise exception 'delete lost format or tenant'; end if;
end $$;
update public.organizations set printing=false where id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.document_print_preferences) then raise exception 'unentitled tenant can read preferences'; end if;
  begin
    perform public.save_document_print_preference('20000000-0000-4000-8000-000000000001','customer-copy','a4',null);
    raise exception 'unentitled mutation accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
