-- Alert email a ogni nuova segnalazione recensione.
-- Il trigger chiama in modo asincrono (pg_net) l'Edge Function
-- notify-review-report, che invia la mail via Resend.

create extension if not exists pg_net with schema extensions;

create or replace function public.handle_new_review_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://nnzsejowzbrjzpaisvpv.supabase.co/functions/v1/notify-review-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uenNlam93emJyanpwYWlzdnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzI3NDEsImV4cCI6MjA5MTc0ODc0MX0.x3OD0_P_vslfcN95on_YYf8xUJhl3VJPVfSPXxz_y1c'
    ),
    body := jsonb_build_object(
      'report_id', new.id,
      'review_id', new.review_id,
      'reporter_id', new.reporter_id,
      'reason', new.reason
    )
  );
  return new;
end;
$$;

drop trigger if exists on_review_report_created on public.review_reports;
create trigger on_review_report_created
  after insert on public.review_reports
  for each row
  execute function public.handle_new_review_report();
