-- Migration pour optimiser les requêtes du Dashboard (Phase 14)
-- Ajout d'une fonction RPC pour obtenir les statistiques globales d'un établissement sans transférer toutes les lignes.

-- 1. Fonction pour obtenir les totaux attendus et perçus globaux
CREATE OR REPLACE FUNCTION get_dashboard_totals(p_tenant_id uuid)
RETURNS TABLE (
  currency text,
  total_expected numeric,
  total_received numeric,
  total_remaining numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH obligation_totals AS (
    SELECT
      fo.currency,
      SUM(fo.initial_amount) AS total_expected,
      COALESCE(SUM(pa.amount), 0) AS total_received
    FROM financial_obligations fo
    LEFT JOIN payment_allocations pa
      ON pa.obligation_id = fo.id
     AND pa.tenant_id = fo.tenant_id
    WHERE fo.tenant_id = p_tenant_id
    GROUP BY fo.currency
  )
  SELECT
    ot.currency,
    ot.total_expected,
    ot.total_received,
    ot.total_expected - ot.total_received AS total_remaining
  FROM obligation_totals ot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fonction pour obtenir les statistiques mensuelles pour l'année en cours
CREATE OR REPLACE FUNCTION get_dashboard_monthly_stats(p_tenant_id uuid, p_year int)
RETURNS TABLE (
  stat_month int,
  currency text,
  total_expected numeric,
  total_received numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH expected AS (
    SELECT
      EXTRACT(MONTH FROM COALESCE(fo.due_date, fo.created_at))::int AS m,
      fo.currency AS c,
      SUM(fo.initial_amount) AS amount
    FROM financial_obligations fo
    WHERE fo.tenant_id = p_tenant_id
      AND EXTRACT(YEAR FROM COALESCE(fo.due_date, fo.created_at)) = p_year
    GROUP BY 1, 2
  ),
  received AS (
    SELECT
      EXTRACT(MONTH FROM p.created_at)::int AS m,
      p.currency AS c,
      SUM(pa.amount) AS amount
    FROM payment_allocations pa
    JOIN payments p
      ON p.id = pa.payment_id
    WHERE pa.tenant_id = p_tenant_id
      AND p.tenant_id = p_tenant_id
      AND p.status = 'confirmed'
      AND EXTRACT(YEAR FROM p.created_at) = p_year
    GROUP BY 1, 2
  )
  SELECT
    COALESCE(e.m, r.m) AS stat_month,
    COALESCE(e.c, r.c) AS currency,
    COALESCE(e.amount, 0) AS total_expected,
    COALESCE(r.amount, 0) AS total_received
  FROM expected e
  FULL OUTER JOIN received r ON e.m = r.m AND e.c = r.c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
