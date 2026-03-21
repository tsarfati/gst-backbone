import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SystemAvatarLibrary, SystemAvatarLibraryItem } from '@/components/avatarLibrary';

const supabaseAny = supabase as any;

export function useSystemAvatarLibraries(currentCompanyId?: string | null) {
  const [libraries, setLibraries] = useState<SystemAvatarLibrary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const [{ data: libsData, error: libsError }, { data: itemsData, error: itemsError }, { data: assignmentsData, error: assignmentsError }] = await Promise.all([
          supabaseAny
            .from('super_admin_avatar_libraries')
            .select('id, name, description, cover_image_url, is_global, is_active')
            .eq('is_active', true)
            .order('name'),
          supabaseAny
            .from('super_admin_avatar_library_items')
            .select('id, library_id, name, image_url, sort_order')
            .order('sort_order')
            .order('created_at'),
          supabaseAny
            .from('super_admin_avatar_library_companies')
            .select('library_id, company_id'),
        ]);

        if (libsError) throw libsError;
        if (itemsError) throw itemsError;
        if (assignmentsError) throw assignmentsError;

        const itemMap = new Map<string, SystemAvatarLibraryItem[]>();
        (itemsData || []).forEach((item: any) => {
          const existing = itemMap.get(item.library_id) || [];
          existing.push(item);
          itemMap.set(item.library_id, existing);
        });

        const assignmentMap = new Map<string, string[]>();
        (assignmentsData || []).forEach((row: any) => {
          const existing = assignmentMap.get(row.library_id) || [];
          existing.push(row.company_id);
          assignmentMap.set(row.library_id, existing);
        });

        const nextLibraries = (libsData || [])
          .map((library: any) => ({
            ...library,
            company_ids: assignmentMap.get(library.id) || [],
            items: itemMap.get(library.id) || [],
          }))
          .filter((library: SystemAvatarLibrary) => {
            if (library.is_global) return true;
            if (!currentCompanyId) return false;
            return (library.company_ids || []).includes(currentCompanyId);
          });

        if (mounted) {
          setLibraries(nextLibraries);
        }
      } catch (error) {
        console.error('Error loading system avatar libraries:', error);
        if (mounted) setLibraries([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [currentCompanyId]);

  const libraryIds = useMemo(() => libraries.map((library) => library.id), [libraries]);

  return {
    libraries,
    libraryIds,
    loading,
  };
}
