import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Briefcase, Building2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { setAuthEntryContext } from "@/utils/authEntryContext";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";
import { setVendorPortalCompanyId } from "@/utils/vendorPortalSession";

type WorkspaceRole = "internal" | "vendor" | "design_professional";

type WorkspaceOption = {
  company_id: string;
  company_name: string;
  company_logo_url: string | null;
  workspace_role: WorkspaceRole;
  user_role: string;
};

const roleLabel = (workspace: WorkspaceOption) => {
  if (workspace.workspace_role === "internal") {
    return `BuilderLYNK Workspace · ${workspace.user_role.replace(/_/g, " ")}`;
  }
  if (workspace.workspace_role === "design_professional") {
    return "Design Professional Portal";
  }
  return "Vendor Portal";
};

export default function VendorPortalChooser() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userCompanies, switchCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<WorkspaceOption[]>([]);
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(null);

  const workspaceRows = useMemo(
    () =>
      userCompanies.map((company) => {
        const role = String(company.role || "").toLowerCase();
        return {
          company_id: company.company_id,
          company_name: company.company_name,
          company_logo_url: null,
          workspace_role:
            role === "vendor"
              ? "vendor"
              : role === "design_professional"
              ? "design_professional"
              : "internal",
          user_role: role || "member",
        } satisfies WorkspaceOption;
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

      if (workspaceRows.length === 0) {
        setOptions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const companyIds = workspaceRows.map((workspace) => workspace.company_id);
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
            },
          ]),
        );

        if (!ignore) {
          setOptions(
            workspaceRows.map((workspace) => ({
              ...workspace,
              company_name: byId.get(workspace.company_id)?.company_name || workspace.company_name,
              company_logo_url: byId.get(workspace.company_id)?.company_logo_url || null,
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load workspace options:", error);
        if (!ignore) {
          setOptions(workspaceRows);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadOptions();
    return () => {
      ignore = true;
    };
  }, [user?.id, workspaceRows]);

  const openWorkspace = async (workspace: WorkspaceOption) => {
    try {
      setOpeningWorkspaceId(workspace.company_id);

      if (workspace.workspace_role === "internal") {
        setAuthEntryContext("builder");
        await switchCompany(workspace.company_id);
        navigate("/dashboard", { replace: true });
        return;
      }

      setAuthEntryContext("vendor");
      setVendorPortalCompanyId(workspace.company_id);
      await switchCompany(workspace.company_id);
      navigate(
        workspace.workspace_role === "design_professional"
          ? "/design-professional/dashboard"
          : "/vendor/dashboard",
        { replace: true },
      );
    } finally {
      setOpeningWorkspaceId(null);
    }
  };

  const internalOptions = options.filter((workspace) => workspace.workspace_role === "internal");
  const externalOptions = options.filter((workspace) => workspace.workspace_role !== "internal");

  if (loading) {
    return <PremiumLoadingScreen text="Loading your workspaces..." />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Choose a Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Select which company and workspace you want to enter for this session.
          </p>
        </div>

        {options.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-sm text-muted-foreground">
              No workspaces are linked to this login yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {internalOptions.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">BuilderLYNK Workspaces</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {internalOptions.map((option) => (
                    <Card key={`${option.workspace_role}:${option.company_id}`} className="border-border/70">
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
                          <ShieldCheck className="h-4 w-4" />
                          {roleLabel(option)}
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => void openWorkspace(option)}
                          disabled={openingWorkspaceId === option.company_id}
                        >
                          {openingWorkspaceId === option.company_id ? "Opening..." : "Open BuilderLYNK Workspace"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {externalOptions.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">External Portals</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {externalOptions.map((option) => (
                    <Card key={`${option.workspace_role}:${option.company_id}`} className="border-border/70">
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
                          {roleLabel(option)}
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => void openWorkspace(option)}
                          disabled={openingWorkspaceId === option.company_id}
                        >
                          {openingWorkspaceId === option.company_id
                            ? "Opening..."
                            : option.workspace_role === "design_professional"
                            ? "Open Design Portal"
                            : "Open Vendor Portal"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
