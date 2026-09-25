-- Phase 15: Prior Debts (Dettes antérieures)

-- Create a view to dynamically calculate prior debts from archived school years
-- A prior debt is the remaining amount due for a student in a given currency
-- across all their obligations in a specific archived school year.

CREATE OR REPLACE VIEW prior_debts WITH (security_invoker = true) AS
SELECT 
    sy.tenant_id,
    fo.student_id,
    fo.school_year_id,
    fo.currency,
    SUM(fo.initial_amount) AS initial_amount,
    SUM(fo.remaining_amount) AS remaining_amount,
    CASE 
        WHEN SUM(fo.remaining_amount) > 0 THEN 'OPEN'
        ELSE 'SETTLED'
    END AS status,
    MIN(fo.created_at) AS created_at,
    MAX(fo.updated_at) AS updated_at
FROM financial_obligations fo
JOIN school_years sy ON sy.id = fo.school_year_id
WHERE sy.status = 'archived'
GROUP BY 
    sy.tenant_id,
    fo.student_id,
    fo.school_year_id,
    fo.currency
HAVING SUM(fo.remaining_amount) > 0;
