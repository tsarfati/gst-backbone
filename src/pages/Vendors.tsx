import { useState, useEffect } from "react";
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

export default function Vendors() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { currentView, setCurrentView } = useVendorViewPreference();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && currentCompany) {
      loadVendors();
    }
  }, [user, currentCompany]);

  const loadVendors = async () => {
    if (!user || !currentCompany) return;
    
    try {
      // Check if current company has shared vendor database enabled
      const { data: companyData } = await supabase
        .from('companies')
        .select('enable_shared_vendor_database')
        .eq('id', currentCompany.id)
        .single();

      let query = supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true);

      if (companyData?.enable_shared_vendor_database) {
        // If shared database is enabled, get vendors from companies that also have it enabled
        const { data: sharedCompanies } = await supabase
          .from('companies')
          .select('id')
          .eq('enable_shared_vendor_database', true);
        
        const companyIds = sharedCompanies?.map(c => c.id) || [currentCompany.id];
        query = query.in('company_id', companyIds);
      } else {
        // Only show vendors from current company
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      toast({
        title: "Error",
        description: "Failed to load vendors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVendorClick = (vendor: any) => {
    navigate(`/vendors/${vendor.id}`);
  };

  const renderVendors = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading vendors...</div>
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
            {vendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} onClick={() => handleVendorClick(vendor)} />
            ))}
          </div>
        );
      case "list":
        return <VendorListView vendors={vendors} onVendorClick={handleVendorClick} />;
      case "compact":
        return <VendorCompactView vendors={vendors} onVendorClick={handleVendorClick} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground">
            Manage vendor relationships and track spending
          </p>
        </div>
        <div className="flex items-center gap-4">
          <VendorViewSelector currentView={currentView} onViewChange={setCurrentView} />
          <Button onClick={() => navigate("/vendors/add")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </div>

      {renderVendors()}
    </div>
  );
}