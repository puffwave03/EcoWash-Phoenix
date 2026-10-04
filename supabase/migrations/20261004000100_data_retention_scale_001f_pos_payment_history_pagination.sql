create index pos_sessions_org_opened_id_idx
on public.pos_sessions (organization_id, opened_at desc, id desc);

create index payments_org_pos_session_created_id_idx
on public.payments (organization_id, pos_session_id, created_at desc, id desc)
where pos_session_id is not null;
