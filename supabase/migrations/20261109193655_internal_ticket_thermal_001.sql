-- INTERNAL-TICKET-THERMAL-001: extend ticket formats using existing profiles.
-- Only these two checks change; defaults, RLS, RPCs and existing rows are preserved.
alter table public.printer_profiles
  drop constraint printer_profiles_paper_format,
  add constraint printer_profiles_paper_format check (
    paper_format in ('receipt_58mm', 'receipt_80mm', 'browser_pdf', 'label_custom', 'ticket_a4', 'ticket_58mm', 'ticket_80mm')
  ),
  drop constraint printer_profiles_ticket_format,
  add constraint printer_profiles_ticket_format check (
    purpose <> 'ticket' or paper_format in ('ticket_a4', 'ticket_58mm', 'ticket_80mm', 'browser_pdf')
  );
