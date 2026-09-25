-- Enable Row Level Security (RLS) on all tables

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE accountants ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_tokens ENABLE ROW LEVEL SECURITY;

-- 1. Helper function to get user memberships efficiently without recursion
CREATE OR REPLACE FUNCTION public.get_user_memberships()
RETURNS TABLE (tenant_id UUID, role user_role)
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT um.tenant_id, um.role
  FROM public.user_memberships um
  WHERE um.user_id = auth.uid() AND um.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- 2. Platform Admin check function (since they are not tied to a tenant, we need to check if they have platform_admin role anywhere)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid() AND um.role = 'platform_admin' AND um.status = 'active'
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Profiles Policies
-- Users can see their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
-- Platform Admins can see all profiles
CREATE POLICY "Platform Admins can view all profiles" ON profiles FOR SELECT USING (public.is_platform_admin());
-- Platform Admins can update all profiles
CREATE POLICY "Platform Admins can update all profiles" ON profiles FOR UPDATE USING (public.is_platform_admin());

-- 4. User Memberships Policies
-- Users can see their own memberships
CREATE POLICY "Users can view own memberships" ON user_memberships FOR SELECT USING (user_id = auth.uid());
-- Platform Admins can see all
CREATE POLICY "Platform Admins can view all memberships" ON user_memberships FOR SELECT USING (public.is_platform_admin());
-- Platform Admins can manage all
CREATE POLICY "Platform Admins can insert memberships" ON user_memberships FOR INSERT WITH CHECK (public.is_platform_admin());
CREATE POLICY "Platform Admins can update memberships" ON user_memberships FOR UPDATE USING (public.is_platform_admin());
CREATE POLICY "Platform Admins can delete memberships" ON user_memberships FOR DELETE USING (public.is_platform_admin());
-- Directors can see memberships of their tenant
CREATE POLICY "Directors can view tenant memberships" ON user_memberships FOR SELECT 
USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'director'));
-- Directors can manage non-platform_admin memberships in their tenant
CREATE POLICY "Directors can insert tenant memberships" ON user_memberships FOR INSERT 
WITH CHECK (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'director') AND role != 'platform_admin');
CREATE POLICY "Directors can update tenant memberships" ON user_memberships FOR UPDATE 
USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'director') AND role != 'platform_admin');

-- 5. Tenants Policies
-- Any user can view the tenant they belong to
CREATE POLICY "Users can view their tenants" ON tenants FOR SELECT USING (id IN (SELECT t.tenant_id FROM public.get_user_memberships() t));
-- Platform Admins can view all tenants
CREATE POLICY "Platform Admins can view all tenants" ON tenants FOR SELECT USING (public.is_platform_admin());
CREATE POLICY "Platform Admins can manage tenants" ON tenants FOR ALL USING (public.is_platform_admin());
-- Directors can update their own tenant
CREATE POLICY "Directors can update their tenant" ON tenants FOR UPDATE USING (id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'director'));

-- 6. Generic Tenant-based Policies for standard data (Director & Accountant)
-- Applicable tables: school_years, classes, fees, fee_schedules, fee_classes, payment_methods, audit_logs
-- These tables are fully readable by anyone in the tenant with role director or accountant.
-- (Platform Admin can do everything via a bypass or explicit rule, but let's be explicit)

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY['school_years', 'classes', 'fees', 'fee_schedules', 'fee_classes', 'payment_methods', 'accountants'];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('CREATE POLICY "Platform Admins can do all on %I" ON %I FOR ALL USING (public.is_platform_admin())', table_name, table_name);
    
    EXECUTE format('CREATE POLICY "Directors can manage %I" ON %I FOR ALL USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = ''director''))', table_name, table_name);
    
    -- Accountants can read
    EXECUTE format('CREATE POLICY "Accountants can view %I" ON %I FOR SELECT USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = ''accountant''))', table_name, table_name);
  END LOOP;
END;
$$;

-- Parents and Students
-- Platform Admins and Directors can do everything
DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY['students', 'parents', 'parent_students', 'financial_obligations', 'payments', 'payment_allocations', 'receipts'];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('CREATE POLICY "Platform Admins can do all on %I" ON %I FOR ALL USING (public.is_platform_admin())', table_name, table_name);
    
    EXECUTE format('CREATE POLICY "Directors can manage %I" ON %I FOR ALL USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = ''director''))', table_name, table_name);
  END LOOP;
END;
$$;

-- Accountants can read students, obligations, payments, etc., and can manage payments/receipts
CREATE POLICY "Accountants can view students" ON students FOR SELECT USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'accountant'));
CREATE POLICY "Accountants can view parents" ON parents FOR SELECT USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'accountant'));
CREATE POLICY "Accountants can view parent_students" ON parent_students FOR SELECT USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'accountant'));
CREATE POLICY "Accountants can manage financial_obligations" ON financial_obligations FOR ALL USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'accountant'));
CREATE POLICY "Accountants can manage payments" ON payments FOR ALL USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'accountant'));
CREATE POLICY "Accountants can manage payment_allocations" ON payment_allocations FOR ALL USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'accountant'));
CREATE POLICY "Accountants can manage receipts" ON receipts FOR ALL USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'accountant'));

-- PARENTS specific policies
-- Parents can see their own parent record
CREATE POLICY "Parents can view own record" ON parents FOR SELECT USING (user_id = auth.uid());
-- Parents can update own record (except tenant_id/etc which should be restricted by API, but RLS allows it within tenant)
CREATE POLICY "Parents can update own record" ON parents FOR UPDATE USING (user_id = auth.uid());

-- Parents can see mapping to their students
CREATE POLICY "Parents can view own student mappings" ON parent_students FOR SELECT USING (parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()));

-- Parents can see their students
CREATE POLICY "Parents can view own students" ON students FOR SELECT USING (
  id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
);

-- Parents can see their students' financial obligations
CREATE POLICY "Parents can view own students obligations" ON financial_obligations FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
);

-- Parents can see their students' payments
CREATE POLICY "Parents can view own students payments" ON payments FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
);

-- Parents can see payment allocations linked to their payments
CREATE POLICY "Parents can view own payment allocations" ON payment_allocations FOR SELECT USING (
  payment_id IN (SELECT id FROM payments WHERE student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())))
);

-- Parents can see receipts linked to their payments
CREATE POLICY "Parents can view own receipts" ON receipts FOR SELECT USING (
  payment_id IN (SELECT id FROM payments WHERE student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())))
);

-- Notifications
CREATE POLICY "Platform Admins can manage all notifications" ON notifications FOR ALL USING (public.is_platform_admin());
CREATE POLICY "Directors can manage tenant notifications" ON notifications FOR ALL USING (tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'director'));
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Activation Tokens
CREATE POLICY "Platform Admins can view activation tokens" ON activation_tokens FOR SELECT USING (public.is_platform_admin());
CREATE POLICY "Directors can view tenant activation tokens" ON activation_tokens FOR SELECT USING (
  user_id IN (SELECT user_id FROM user_memberships WHERE tenant_id IN (SELECT t.tenant_id FROM public.get_user_memberships() t WHERE t.role = 'director'))
);
-- Users can view their own tokens (useful for verifying expiration via API)
CREATE POLICY "Users can view own activation tokens" ON activation_tokens FOR SELECT USING (user_id = auth.uid());

