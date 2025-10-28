-- Phase 1: Database Schema Extensions

-- Create permission enums
CREATE TYPE permission_scope AS ENUM (
  'users', 'transactions', 'accounts', 'reports', 
  'settings', 'compliance', 'api', 'branches', 
  'fees', 'webhooks', 'audit_logs'
);

CREATE TYPE permission_action AS ENUM (
  'view', 'create', 'update', 'delete', 'approve', 'export'
);

-- Branches table for managing bank/FI branches
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  branch_code TEXT NOT NULL,
  branch_type TEXT NOT NULL CHECK (branch_type IN ('main', 'regional', 'local')),
  address JSONB NOT NULL,
  phone TEXT,
  email TEXT,
  manager_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  opening_hours JSONB,
  services_offered TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(institution_id, branch_code)
);

-- Staff assignments linking users to institutions and branches
CREATE TABLE staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  position TEXT NOT NULL,
  department TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
  start_date DATE,
  end_date DATE,
  UNIQUE(user_id, institution_id, branch_id)
);

-- Role permissions table
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  scope permission_scope NOT NULL,
  actions permission_action[] NOT NULL,
  institution_id UUID REFERENCES institutions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(role, scope, institution_id)
);

-- User-specific permission overrides
CREATE TABLE user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope permission_scope NOT NULL,
  actions permission_action[] NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  reason TEXT,
  UNIQUE(user_id, scope)
);

-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Branches policies
CREATE POLICY "Admins can manage all branches"
  ON branches FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institution users can view own branches"
  ON branches FOR SELECT
  TO authenticated
  USING (
    institution_id IN (
      SELECT id FROM institutions WHERE user_id = auth.uid()
    )
  );

-- Staff assignments policies
CREATE POLICY "Admins can manage all staff assignments"
  ON staff_assignments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own assignments"
  ON staff_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Institution admins can view their staff"
  ON staff_assignments FOR SELECT
  TO authenticated
  USING (
    institution_id IN (
      SELECT sa.institution_id 
      FROM staff_assignments sa
      WHERE sa.user_id = auth.uid() 
      AND sa.position LIKE '%admin%'
    )
  );

CREATE POLICY "Institution admins can create staff assignments"
  ON staff_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    institution_id IN (
      SELECT sa.institution_id 
      FROM staff_assignments sa
      WHERE sa.user_id = auth.uid() 
      AND sa.position LIKE '%admin%'
    )
  );

-- Permission policies
CREATE POLICY "Admins can manage permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user overrides"
  ON user_permission_overrides FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Helper function to check permissions
CREATE OR REPLACE FUNCTION has_permission(
  _user_id UUID,
  _scope permission_scope,
  _action permission_action
) RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  -- Check user-specific overrides first
  SELECT EXISTS(
    SELECT 1 FROM user_permission_overrides
    WHERE user_id = _user_id
    AND scope = _scope
    AND _action = ANY(actions)
    AND (expires_at IS NULL OR expires_at > now())
  ) INTO has_perm;
  
  IF has_perm THEN
    RETURN true;
  END IF;
  
  -- Check role-based permissions
  SELECT EXISTS(
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
    AND rp.scope = _scope
    AND _action = ANY(rp.actions)
  ) INTO has_perm;
  
  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update updated_at on branches
CREATE OR REPLACE FUNCTION update_branch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branch_updated_at();