import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { Building2, ArrowRight, Briefcase } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { setAuthEntryContext } from "@/utils/authEntryContext";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";
import { setVendorPortalCompanyId } from "@/utils/vendorPortalSession";

type VendorPortalOption = {
  company_id: string;
  company_name: string;
  company_logo_url: string | null;
};

export default function VendorPortalChooser() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userCompanies, switchCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<VendorPortalOption[]>([]);
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(null);

  const vendorCompanyRows = useMemo(
    () =>
      userCompanies.filter((company) => {
        const role = String(company.role || "").toLowerCase();
        return role === "vendor";
      }),
    [userCompanies],
  );

  useEffect(() => {
    let ignore = false;

    async function loadOptions() {
      if (!user?.id) {
        setOptions([]);
        setLoading(false);
        return;
      }

      if (vendorCompanyRows.length === 0) {
        setOptions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const companyIds = vendorCompanyRows.map((company) => company.company_id);
        const { data, error } = await supabase
          .from("companies")
          .select("id, name, display_name, logo_url")
          .in("id", companyIds);

        if (error) throw error;

        const byId = new Map(
          ((data || []) as any[]).map((row: any) => [
            String(row.id),
            {
              company_id: String(row.id),
              company_name: String(row.display_name || row.name || row.id),
              company_logo_url: resolveCompanyLogoUrl(row.logo_url),
            } satisfies VendorPortalOption,
          ]),
        );

        const nextOptions = vendorCompanyRows.map((company) => (
          byId.get(company.company_id) || {
            company_id: company.company_id,
            company_name: company.company_name,
            company_logo_url: null,
          }
        ));

        if (!ignore) {
          setOptions(nextOptions);
        }
      } catch (error) {
        console.error("Failed to load vendor portal options:", error);
        if (!ignore) {
          setOptions(
            vendorCompanyRows.map((company) => ({
              company_id: company.company_id,
              company_name: company.company_name,
              company_logo_url: null,
            })),
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadOptions();
    return () => {
      ignore = true;
    };
  }, [user?.id, vendorCompanyRows]);

  const enterVendorPortal = async (companyId: string) => {
    try {
      setSwitchingCompanyId(companyId);
      setAuthEntryContext("vendor");
      setVendorPortalCompanyId(companyId);
      await switchCompany(companyId);
      navigate("/vendor/dashboard", { replace: true });
    } finally {
      setSwitchingCompanyId(null);
    }
  };

  if (loading) {
    return <PremiumLoadingScreen text="Loading your vendor portals..." />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Choose a Vendor Portal</h1>
        <p className="text-sm text-muted-foreground">
          Select the builder company whose vendor portal you want to enter.
        </p>
      </div>

      {options.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No vendor portals are linked to this login yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {options.map((option) => (
            <Card key={option.company_id} className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  {option.company_logo_url ? (
                    <img src={option.company_logo_url} alt={option.company_name} className="h-10 w-auto max-w-[140px] object-contain" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border text-muted-foreground">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <span className="min-w-0 truncate">{option.company_name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Vendor portal access
                </div>
                <Button
                  className="w-full"
                  onClick={() => void enterVendorPortal(option.company_id)}
                  disabled={switchingCompanyId === option.company_id}
                >
                  {switchingCompanyId === option.company_id ? "Opening..." : "Open Vendor Portal"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
