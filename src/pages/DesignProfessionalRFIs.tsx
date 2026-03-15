import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Loader2, Search } from "lucide-react";
import { format } from "date-fns";

type RfiRow = {
  id: string;
  rfi_number: string;
  subject: string;
  status: string;
  ball_in_court: string;
  due_date: string | null;
  updated_at: string;
  job_id: string;
  assigned_to: string | null;
  company_id: string;
};

type JobLookup = {
  id: string;
  name: string;
};

const badgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "closed") return "default";
  if (status === "overdue") return "destructive";
  if (status === "submitted" || status === "answered") return "secondary";
  return "outline";
};

export default function DesignProfessionalRFIs() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<RfiRow[]>([]);
  const [jobMap, setJobMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const load = async () => {
      if (!user?.id || !currentCompany?.id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("rfis")
          .select("id,rfi_number,subject,status,ball_in_court,due_date,updated_at,job_id,assigned_to,company_id")
          .or(`assigned_to.eq.${user.id},company_id.eq.${currentCompany.id}`)
          .order("updated_at", { ascending: false });

        if (error) throw error;

        const rfis = (data || []) as RfiRow[];
        setRows(rfis);

        const jobIds = Array.from(new Set(rfis.map((row) => row.job_id).filter(Boolean)));
        if (jobIds.length > 0) {
          const { data: jobsData, error: jobsError } = await supabase
            .from("jobs")
            .select("id,name")
            .in("id", jobIds);
          if (jobsError) throw jobsError;
          const lookup = new Map((jobsData || []).map((job: JobLookup) => [job.id, job.name]));
          setJobMap(lookup);
        } else {
          setJobMap(new Map());
        }
      } catch (error: any) {
        console.error("Error loading design professional RFIs:", error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load RFIs.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user?.id, currentCompany?.id]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      row.rfi_number.toLowerCase().includes(query) ||
      row.subject.toLowerCase().includes(query) ||
      (jobMap.get(row.job_id) || "").toLowerCase().includes(query),
    );
  }, [rows, search, jobMap]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">RFIs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Request-for-information items assigned to you and your Design Pro company jobs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            RFI Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search RFIs..."
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="py-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span className="loading-dots">Loading</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No RFIs found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFI #</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ball In Court</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.rfi_number}</TableCell>
                    <TableCell>{row.subject}</TableCell>
                    <TableCell>{jobMap.get(row.job_id) || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(row.status)}>{row.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{(row.ball_in_court || "-").replace(/_/g, " ")}</TableCell>
                    <TableCell>{row.due_date ? format(new Date(row.due_date), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>{format(new Date(row.updated_at), "MMM d, yyyy")}</TableCell>
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
