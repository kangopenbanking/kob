import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loggedPermissionCheck } from '@/lib/database-logger';

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

    return loggedPermissionCheck(
      userId,
      'permission',
      `${scope}.${action}`,
      async () => {
        try {
          const { data, error } = await supabase.rpc('has_permission', {
            _user_id: userId,
            _scope: scope as any,
            _action: action as any
          });

          if (error) {
            throw error;
          }

          return data || false;
        } catch (error) {
          throw error;
        }
      }
    );
  };

  const hasRole = async (role: string): Promise<boolean> => {
    if (!userId) return false;

    return loggedPermissionCheck(
      userId,
      'role',
      role,
      async () => {
        try {
          const { data, error } = await supabase.rpc('has_role', {
            _user_id: userId,
            _role: role as any
          });

          if (error) {
            throw error;
          }

          return data || false;
        } catch (error) {
          throw error;
        }
      }
    );
  };

  const getUserPermissions = async () => {
    if (!userId) return { rolePermissions: [], userOverrides: [] };

    try {
      // Get role-based permissions
      const { data: rolePerms, error: roleError } = await supabase
        .from('user_roles')
        .select('role, role_permissions(scope, actions)')
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Get user-specific overrides
      const { data: userPerms, error: userError } = await supabase
        .from('user_permission_overrides')
        .select('scope, actions')
        .eq('user_id', userId)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (userError) throw userError;

      return {
        rolePermissions: rolePerms || [],
        userOverrides: userPerms || []
      };
    } catch (error: any) {
      if (error?.code === '42501') {
        console.error('RLS policy error when fetching permissions:', error);
      } else {
        console.error('Failed to get user permissions:', error);
      }
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
