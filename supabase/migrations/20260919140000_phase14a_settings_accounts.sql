-- Phase 14A: Paramètres & Gestion Sécurisée des Comptes

-- =========================================================
-- 1. TABLE platform_settings (Super Admin uniquement)
-- =========================================================
CREATE TABLE IF NOT EXISTS platform_settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT NOT NULL UNIQUE,
    value       JSONB NOT NULL DEFAULT '{}',
    updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Seul le platform_admin peut lire les paramètres globaux
CREATE POLICY "Platform admins can view platform settings" ON platform_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_memberships
            WHERE user_id = auth.uid() AND role = 'platform_admin' AND status = 'active'
        )
    );

-- Seul le platform_admin peut modifier les paramètres globaux
CREATE POLICY "Platform admins can manage platform settings" ON platform_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_memberships
            WHERE user_id = auth.uid() AND role = 'platform_admin' AND status = 'active'
        )
    );

-- Insérer les valeurs par défaut des paramètres plateforme
INSERT INTO platform_settings (key, value) VALUES
    ('platform_info', '{"name": "Paylix", "description": "Plateforme de gestion financière scolaire", "contact_email": "", "support_url": ""}'),
    ('global_preferences', '{"default_language": "fr", "date_format": "DD/MM/YYYY", "currency_display": "both"}')
ON CONFLICT (key) DO NOTHING;


-- =========================================================
-- 2. COLONNES SUPPLÉMENTAIRES SUR tenants
--    (paramètres établissement pour reçus et identité)
-- =========================================================
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS short_name TEXT,
    ADD COLUMN IF NOT EXISTS receipt_footer_text TEXT,
    ADD COLUMN IF NOT EXISTS receipt_signature_url TEXT,
    ADD COLUMN IF NOT EXISTS receipt_stamp_url TEXT;


-- =========================================================
-- 3. STORAGE BUCKET: profile-images (avatars utilisateurs)
-- =========================================================
-- Bucket privé — les fichiers ne sont accessibles qu'au propriétaire
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-images',
    'profile-images',
    false,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Un utilisateur peut uploader dans son propre dossier: profile-images/{user_id}/...
DO $$ BEGIN
  CREATE POLICY "Users can upload their own profile image" ON storage.objects
      FOR INSERT WITH CHECK (
          bucket_id = 'profile-images'
          AND auth.uid()::TEXT = (storage.foldername(name))[1]
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view their own profile image" ON storage.objects
      FOR SELECT USING (
          bucket_id = 'profile-images'
          AND auth.uid()::TEXT = (storage.foldername(name))[1]
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own profile image" ON storage.objects
      FOR DELETE USING (
          bucket_id = 'profile-images'
          AND auth.uid()::TEXT = (storage.foldername(name))[1]
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile image" ON storage.objects
      FOR UPDATE USING (
          bucket_id = 'profile-images'
          AND auth.uid()::TEXT = (storage.foldername(name))[1]
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Platform admins can view all profile images" ON storage.objects
      FOR SELECT USING (
          bucket_id = 'profile-images'
          AND EXISTS (
              SELECT 1 FROM user_memberships
              WHERE user_id = auth.uid() AND role = 'platform_admin' AND status = 'active'
          )
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =========================================================
-- 4. STORAGE BUCKET: tenant-assets (logos & assets établ.)
-- =========================================================
-- Bucket public — les logos sont affichés publiquement (reçus, portail parent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'tenant-assets',
    'tenant-assets',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public can view tenant assets" ON storage.objects
      FOR SELECT USING (bucket_id = 'tenant-assets');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Directors can upload their tenant assets" ON storage.objects
      FOR INSERT WITH CHECK (
          bucket_id = 'tenant-assets'
          AND EXISTS (
              SELECT 1 FROM user_memberships
              WHERE user_id = auth.uid()
                AND role = 'director'
                AND status = 'active'
                AND tenant_id::TEXT = (storage.foldername(name))[1]
          )
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Directors can delete their tenant assets" ON storage.objects
      FOR DELETE USING (
          bucket_id = 'tenant-assets'
          AND EXISTS (
              SELECT 1 FROM user_memberships
              WHERE user_id = auth.uid()
                AND role = 'director'
                AND status = 'active'
                AND tenant_id::TEXT = (storage.foldername(name))[1]
          )
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Platform admins can manage all tenant assets" ON storage.objects
      FOR ALL USING (
          bucket_id = 'tenant-assets'
          AND EXISTS (
              SELECT 1 FROM user_memberships
              WHERE user_id = auth.uid() AND role = 'platform_admin' AND status = 'active'
          )
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =========================================================
-- 5. AUDIT LOGS — autoriser les INSERT par les utilisateurs
--    authentifiés (pour les actions account/profile côté serveur)
-- =========================================================
-- Note: les inserts dans audit_logs se font via SECURITY DEFINER functions
-- ou via le service role — pas besoin de policy INSERT supplémentaire.
-- La policy existante permet SELECT aux directeurs et platform_admins.


-- =========================================================
-- 6. TRIGGER updated_at sur platform_settings
-- =========================================================
CREATE TRIGGER set_platform_settings_updated_at
    BEFORE UPDATE ON platform_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

