import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePermissions() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    loadUser();
  }, []);

  const checkPermission = async (scope: string, action: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { data, error } = await supabase.rpc('has_permission', {
        _user_id: userId,
        _scope: scope as any,
        _action: action as any
      });

      if (error) {
        console.error('Permission check error:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  };

  const hasRole = async (role: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: role as any
      });

      if (error) {
        console.error('Role check error:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Role check failed:', error);
      return false;
    }
  };

  const getUserPermissions = async () => {
    if (!userId) return [];

    try {
      // Get role-based permissions
      const { data: rolePerms } = await supabase
        .from('user_roles')
        .select('role, role_permissions(scope, actions)')
        .eq('user_id', userId);

      // Get user-specific overrides
      const { data: userPerms } = await supabase
        .from('user_permission_overrides')
        .select('scope, actions')
        .eq('user_id', userId)
        .or('expires_at.is.null,expires_at.gt.now()');

      return {
        rolePermissions: rolePerms || [],
        userOverrides: userPerms || []
      };
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      return { rolePermissions: [], userOverrides: [] };
    }
  };

  return { 
    checkPermission, 
    hasRole,
    getUserPermissions,
    userId 
  };
}
