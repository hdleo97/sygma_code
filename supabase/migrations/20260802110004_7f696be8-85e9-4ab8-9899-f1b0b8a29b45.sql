ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS pieces_utilisees text,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS interventions_complementaires text,
  ADD COLUMN IF NOT EXISTS signature_superviseur text,
  ADD COLUMN IF NOT EXISTS signature_superviseur_nom text,
  ADD COLUMN IF NOT EXISTS signature_superviseur_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_valideur text,
  ADD COLUMN IF NOT EXISTS signature_valideur_nom text,
  ADD COLUMN IF NOT EXISTS signature_valideur_at timestamptz;

CREATE OR REPLACE FUNCTION public.intervention_lock_when_signed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.statut = 'signee' THEN
    RAISE EXCEPTION 'Rapport signé : ce rapport est verrouillé en lecture seule';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intervention_lock_when_signed ON public.interventions;
CREATE TRIGGER trg_intervention_lock_when_signed
BEFORE UPDATE ON public.interventions
FOR EACH ROW EXECUTE FUNCTION public.intervention_lock_when_signed();

CREATE OR REPLACE FUNCTION public.rapport_ops_lock_when_signed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _statut intervention_statut;
  _iid uuid;
BEGIN
  _iid := COALESCE(NEW.intervention_id, OLD.intervention_id);
  SELECT statut INTO _statut FROM public.interventions WHERE id = _iid;
  IF _statut = 'signee' THEN
    RAISE EXCEPTION 'Rapport signé : ce rapport est verrouillé en lecture seule';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_rapport_ops_lock_when_signed ON public.rapport_operations_realisees;
CREATE TRIGGER trg_rapport_ops_lock_when_signed
BEFORE INSERT OR UPDATE OR DELETE ON public.rapport_operations_realisees
FOR EACH ROW EXECUTE FUNCTION public.rapport_ops_lock_when_signed();