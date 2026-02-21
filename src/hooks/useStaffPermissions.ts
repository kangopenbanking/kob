import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StaffPermission {
  section_key: string;
  can_view: boolean;
  can_manage: boolean;
}

interface UseStaffPermissionsResult {
  isOwner: boolean;
  isStaff: boolean;
  allowedSections: StaffPermission[];
  loading: boolean;
  canAccess: (sectionKey: string) => boolean;
  canManage: (sectionKey: string) => boolean;
}

export function useStaffPermissions(): UseStaffPermissionsResult {
  const [isOwner, setIsOwner] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [allowedSections, setAllowedSections] = useState<StaffPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Check if user is institution owner
      const { data: institution } = await supabase
        .from('institutions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (institution) {
        setIsOwner(true);
        setLoading(false);
        return;
      }

      // Check if user is admin
      const { data: adminRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin' as any,
      });

      if (adminRole) {
        setIsOwner(true); // admins get full access
        setLoading(false);
        return;
      }

      // Check if user is staff with portal permissions
      const { data: staffRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'staff' as any,
      });

      if (staffRole) {
        setIsStaff(true);
        const { data: sections } = await supabase.rpc('get_staff_portal_sections', {
          _user_id: user.id,
        });

        if (sections) {
          setAllowedSections(sections as StaffPermission[]);
        }
      }
    } catch (error) {
      console.error('Error checking staff permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const canAccess = (sectionKey: string): boolean => {
    if (isOwner) return true;
    if (!isStaff) return false;
    // Staff always have access to dashboard
    if (sectionKey === 'dashboard') return true;
    return allowedSections.some(s => s.section_key === sectionKey && s.can_view);
  };

  const canManage = (sectionKey: string): boolean => {
    if (isOwner) return true;
    if (!isStaff) return false;
    return allowedSections.some(s => s.section_key === sectionKey && s.can_manage);
  };

  return { isOwner, isStaff, allowedSections, loading, canAccess, canManage };
}
