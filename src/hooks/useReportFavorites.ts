import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface ReportFavorite {
  id: string;
  report_key: string;
  report_category: string;
}

export function useReportFavorites(category: string) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user?.id || !currentCompany?.id) {
        setFavorites(new Set());
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_report_favorites")
          .select("report_key")
          .eq("user_id", user.id)
          .eq("company_id", currentCompany.id)
          .eq("report_category", category);

        if (error) throw error;

        setFavorites(new Set(data?.map((f) => f.report_key) || []));
      } catch (err) {
        console.error("Error loading report favorites:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [user?.id, currentCompany?.id, category]);

  const toggleFavorite = useCallback(
    async (reportKey: string) => {
      if (!user?.id || !currentCompany?.id) {
        toast.error("Please log in to save favorites");
        return;
      }

      const isFavorite = favorites.has(reportKey);

      // Optimistic update
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFavorite) {
          next.delete(reportKey);
        } else {
          next.add(reportKey);
        }
        return next;
      });

      try {
        if (isFavorite) {
          // Remove favorite
          const { error } = await supabase
            .from("user_report_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("company_id", currentCompany.id)
            .eq("report_key", reportKey);

          if (error) throw error;
          toast.success("Removed from favorites");
        } else {
          // Add favorite
          const { error } = await supabase.from("user_report_favorites").insert({
            user_id: user.id,
            company_id: currentCompany.id,
            report_key: reportKey,
            report_category: category,
          });

          if (error) throw error;
          toast.success("Added to favorites");
        }
      } catch (err) {
        console.error("Error toggling favorite:", err);
        // Revert optimistic update
        setFavorites((prev) => {
          const next = new Set(prev);
          if (isFavorite) {
            next.add(reportKey);
          } else {
            next.delete(reportKey);
          }
          return next;
        });
        toast.error("Failed to update favorite");
      }
    },
    [user?.id, currentCompany?.id, category, favorites]
  );

  const isFavorite = useCallback(
    (reportKey: string) => favorites.has(reportKey),
    [favorites]
  );

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorite,
    favoritesCount: favorites.size,
  };
}
