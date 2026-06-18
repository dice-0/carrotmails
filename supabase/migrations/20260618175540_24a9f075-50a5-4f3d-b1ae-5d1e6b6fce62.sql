
REVOKE INSERT ON public.form_submissions FROM anon, authenticated;
COMMENT ON TABLE public.form_submissions IS
  'Inserts are performed exclusively server-side via the service-role client (see src/lib/forms-public.functions.ts). Client-side inserts are intentionally revoked.';
