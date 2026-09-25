-- Migration Phase 5 : Établissements, Responsables, Années Scolaires, Classes

-- 1. Ajout de `must_change_password` à `profiles`
ALTER TABLE profiles ADD COLUMN must_change_password BOOLEAN DEFAULT false;

-- 2. Création de la table de jonction `class_school_years`
CREATE TABLE class_school_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, school_year_id)
);

-- Index pour la table de jonction
CREATE INDEX idx_class_school_years_tenant ON class_school_years(tenant_id);
CREATE INDEX idx_class_school_years_class ON class_school_years(class_id);
CREATE INDEX idx_class_school_years_school_year ON class_school_years(school_year_id);

-- 3. Migration des données existantes (au cas où il y a déjà des classes liées à des années)
INSERT INTO class_school_years (tenant_id, class_id, school_year_id)
SELECT tenant_id, id, school_year_id FROM classes WHERE school_year_id IS NOT NULL;

-- 4. Suppression de la contrainte et de la colonne `school_year_id` dans `classes`
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_tenant_id_school_year_id_name_key;
ALTER TABLE classes DROP COLUMN school_year_id;
ALTER TABLE classes ADD CONSTRAINT classes_tenant_id_name_key UNIQUE(tenant_id, name);

-- 5. Contrainte pour une seule année scolaire active par tenant
CREATE UNIQUE INDEX one_active_year_per_tenant ON school_years(tenant_id) WHERE status = 'active';

-- 6. RLS pour class_school_years
ALTER TABLE class_school_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage all class_school_years" 
    ON class_school_years FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM user_memberships 
            WHERE user_memberships.user_id = auth.uid() 
            AND user_memberships.role = 'platform_admin'
        )
    );

CREATE POLICY "Users can view class_school_years in their tenants" 
    ON class_school_years FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_memberships 
            WHERE user_memberships.user_id = auth.uid() 
            AND user_memberships.tenant_id = class_school_years.tenant_id
        )
    );

CREATE POLICY "Directors can manage class_school_years in their tenant" 
    ON class_school_years FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM user_memberships 
            WHERE user_memberships.user_id = auth.uid() 
            AND user_memberships.tenant_id = class_school_years.tenant_id 
            AND user_memberships.role = 'director'
        )
    );

