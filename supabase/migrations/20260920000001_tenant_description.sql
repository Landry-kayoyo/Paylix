-- Phase 14B: Ajout du champ description pour la personnalisation de l'établissement
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS short_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS receipt_footer_text text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS receipt_signature_url text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS receipt_stamp_url text;
