import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileCheck, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { canAccessAssignedJobOnly } from "@/utils/jobAccess";
import { format } from "date-fns";

interface SubmittalRow {
  id: string;
  submittal_number: string;
  title: string;
  status: string;
  due_date: string | null;
  updated_at: string;
  job_id: string;
  jobs?: { name: string } | null;
}

const badgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "approved" || status === "closed") return "default";
  if (status === "rejected") return "destructive";
  if (status === "in_review" || status === "submitted") return "secondary";
  return "outline";
};

export default function ConstructionSubmittals() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const [rows, setRows] = useState<SubmittalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!currentCompany?.id || websiteJobAccessLoading) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("submittals")
          .select("id, submittal_number, title, status, due_date, updated_at, job_id, jobs(name)")
          .eq("company_id", currentCompany.id)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        const scoped = (data || []).filter((row: any) =>
          canAccessAssignedJobOnly([row.job_id], isPrivileged, allowedJobIds)
        );
        setRows(scoped as unknown as SubmittalRow[]);
      } catch (error) {
        console.error("Error loading submittals:", error);
        toast({
          title: "Error",
          description: "Failed to load submittals",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(","), toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.submittal_number.toLowerCase().includes(q) ||
      row.title.toLowerCase().includes(q) ||
      (row.jobs?.name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="space-y-4 px-4 md:px-6 pb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/construction/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Submittals</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            All Submittals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submittals..."
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="py-10 text-center text-muted-foreground"><span className="loading-dots">Loading</span></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No submittals found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submittal #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.submittal_number}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{row.jobs?.name || "-"}</TableCell>
                    <TableCell><Badge variant={badgeVariant(row.status)}>{row.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{row.due_date ? format(new Date(row.due_date), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>{format(new Date(row.updated_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/jobs/${row.job_id}?tab=submittals`)}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

