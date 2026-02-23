import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveStorageUrl } from '@/utils/storageUtils';

/**
 * Resolves the best avatar URL for a user:
 * 1. avatar_url from profile (if set)
 * 2. Latest punch-out or punch-in photo from time_cards
 * 3. null (caller should show initials)
 */
export function useUserAvatar(userId: string | null | undefined): {
  avatarUrl: string | null;
  loading: boolean;
} {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setAvatarUrl(null);
      return;
    }

    let cancelled = false;
    const resolve = async () => {
      setLoading(true);
      try {
        // 1. Check profile avatar_url
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', userId)
          .maybeSingle();

        if (cancelled) return;

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
          setLoading(false);
          return;
        }

        // 2. Fallback: latest punch photo from time_cards
        const { data: tc } = await supabase
          .from('time_cards')
          .select('punch_out_photo_url, punch_in_photo_url')
          .eq('user_id', userId)
          .order('punch_in_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        const photoPath = tc?.punch_out_photo_url || tc?.punch_in_photo_url || null;
        if (photoPath) {
          const signedUrl = await resolveStorageUrl('punch-photos', photoPath);
          if (!cancelled) setAvatarUrl(signedUrl);
        } else {
          setAvatarUrl(null);
        }
      } catch (err) {
        console.warn('useUserAvatar error:', err);
        if (!cancelled) setAvatarUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [userId]);

  return { avatarUrl, loading };
}

/**
 * Batch version: resolve avatars for multiple user IDs at once.
 * Returns a map of userId -> resolved avatar URL.
 */
export function useUserAvatars(userIds: string[]): {
  avatarMap: Record<string, string | null>;
  loading: boolean;
} {
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ids = userIds.filter(Boolean);
    if (ids.length === 0) {
      setAvatarMap({});
      return;
    }

    let cancelled = false;
    const resolve = async () => {
      setLoading(true);
      try {
        const map: Record<string, string | null> = {};

        // 1. Batch fetch profile avatars
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, avatar_url')
          .in('user_id', ids);

        if (cancelled) return;

        const needsPunchPhoto: string[] = [];
        for (const id of ids) {
          const p = profiles?.find(pr => pr.user_id === id);
          if (p?.avatar_url) {
            map[id] = p.avatar_url;
          } else {
            needsPunchPhoto.push(id);
          }
        }

        // 2. For users without avatar_url, get latest punch photo
        if (needsPunchPhoto.length > 0) {
          // Fetch latest time card per user (using a single query with distinct)
          const { data: cards } = await supabase
            .from('time_cards')
            .select('user_id, punch_out_photo_url, punch_in_photo_url')
            .in('user_id', needsPunchPhoto)
            .order('punch_in_time', { ascending: false });

          if (cancelled) return;

          // Group by user, take first (latest) per user
          const seen = new Set<string>();
          const resolvePromises: Promise<void>[] = [];
          for (const card of (cards || [])) {
            if (seen.has(card.user_id)) continue;
            seen.add(card.user_id);
            const photoPath = card.punch_out_photo_url || card.punch_in_photo_url;
            if (photoPath) {
              resolvePromises.push(
                resolveStorageUrl('punch-photos', photoPath).then(url => {
                  if (!cancelled) map[card.user_id] = url;
                })
              );
            }
          }
          await Promise.all(resolvePromises);

          // Set null for users with no photo at all
          for (const id of needsPunchPhoto) {
            if (!(id in map)) map[id] = null;
          }
        }

        if (!cancelled) setAvatarMap(map);
      } catch (err) {
        console.warn('useUserAvatars error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [JSON.stringify(userIds)]);

  return { avatarMap, loading };
}
