import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import VendorViewSelector, { VendorViewType } from "@/components/VendorViewSelector";
import VendorCard from "@/components/VendorCard";
import VendorListView from "@/components/VendorListView";
import VendorCompactView from "@/components/VendorCompactView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useVendorViewPreference } from "@/hooks/useVendorViewPreference";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { useActionPermissions } from "@/hooks/useActionPermissions";

export default function Vendors() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { canCreate } = useActionPermissions();
  const { currentView, setCurrentView, setDefaultView, isDefault } = useVendorViewPreference();
  const [letter, setLetter] = useState<string>('All');
  const letters = useMemo(() => ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'], []);

  const fetchVendors = async () => {
    if (!currentCompany) return [] as any[];

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .eq('company_id', currentCompany.id)
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading vendors:', error);
      toast({ title: 'Error', description: 'Failed to load vendors', variant: 'destructive' });
      return [] as any[];
    }
  };

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors', currentCompany?.id],
    queryFn: fetchVendors,
    enabled: !!user && !!currentCompany,
    staleTime: 5 * 60 * 1000,
  });

  const filteredVendors = useMemo(() => {
    if (!vendors) return [] as any[];
    if (letter === 'All') return vendors;
    const regex = /^[A-Z]/i;
    if (letter === '#') {
      return vendors.filter((v: any) => !regex.test((v.name || '').trim()));
    }
    return vendors.filter((v: any) => (v.name || '').toUpperCase().startsWith(letter));
  }, [vendors, letter]);

  const handleVendorClick = (vendor: any) => {
    navigate(`/vendors/${vendor.id}`);
  };

  const renderVendors = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-40 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      );
    }

    if (vendors.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <Plus className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No vendors found</p>
            <p className="text-sm">Add your first vendor to get started</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case "tiles":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} onClick={() => handleVendorClick(vendor)} />
            ))}
          </div>
        );
      case "list":
        return <VendorListView vendors={filteredVendors} onVendorClick={handleVendorClick} />;
      case "compact":
        return <VendorCompactView vendors={filteredVendors} onVendorClick={handleVendorClick} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
        </div>
        <div className="flex items-center gap-4">
          <VendorViewSelector
            currentView={currentView}
            onViewChange={setCurrentView}
            onSetDefault={setDefaultView}
            isDefault={isDefault}
          />
          {canCreate('vendors') && (
            <Button onClick={() => navigate("/vendors/add")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          )}
        </div>
      </div>
      {/* Alphabet navigation - rolodex style */}
      <div className="relative mb-6 border-b border-border">
        <div className="flex overflow-x-auto scrollbar-hide pb-2 gap-1">
          {letters.map((l) => (
            <button
              key={l}
              onClick={() => setLetter(l)}
              className={`
                relative px-4 py-2 min-w-[2.5rem] text-sm font-medium
                transition-all duration-200 rounded-t-lg
                ${letter === l
                  ? 'bg-background text-foreground border-t-2 border-x border-primary shadow-sm translate-y-[2px] z-10'
                  : 'bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 border-t border-x border-transparent'
                }
              `}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {renderVendors()}
    </div>
  );
}
