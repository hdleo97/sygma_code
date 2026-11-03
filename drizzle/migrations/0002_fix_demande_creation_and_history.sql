-- Evaluate visibility directly on the new row: a STABLE lookup by id cannot see
-- the row during INSERT ... RETURNING's SELECT-policy check.
ALTER POLICY di_select ON public.demandes_intervention USING (
  public.user_in_etablissement(auth.uid(), etablissement_id)
  AND (
    demandeur_id = auth.uid()
    OR technicien_id = auth.uid()
    OR public.can_manage_intervention(auth.uid(), etablissement_id)
    OR EXISTS (
      SELECT 1 FROM public.prestataires p
      WHERE p.id = prestataire_id
        AND p.user_id = auth.uid()
        AND p.etablissement_id = demandes_intervention.etablissement_id
    )
  )
);
-- Only table triggers may append immutable history, after parent RLS has passed.
ALTER FUNCTION public.di_log_creation() SECURITY DEFINER;
ALTER FUNCTION public.di_log_creation() SET search_path = public;
ALTER FUNCTION public.di_check_transition() SECURITY DEFINER;
ALTER FUNCTION public.di_check_transition() SET search_path = public;
REVOKE ALL ON FUNCTION public.di_log_creation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.di_check_transition() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.di_log_creation() IS 'Trigger-only history writer; demand INSERT RLS enforces requester ownership and site membership.';
COMMENT ON FUNCTION public.di_check_transition() IS 'Trigger-only transition validation and immutable history writer; parent UPDATE RLS remains enforced.';