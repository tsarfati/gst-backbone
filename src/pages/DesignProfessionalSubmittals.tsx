import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileCheck, Loader2, Search } from "lucide-react";
import { format } from "date-fns";

type SubmittalRow = {
  id: string;
  submittal_number: string;
  title: string;
  status: string;
  due_date: string | null;
  updated_at: string;
  assigned_to: string | null;
  company_id: string;
  jobs?: { name: string } | null;
};

const badgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "approved" || status === "closed") return "default";
  if (status === "rejected") return "destructive";
  if (status === "in_review" || status === "submitted") return "secondary";
  return "outline";
};

export default function DesignProfessionalSubmittals() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<SubmittalRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id || !currentCompany?.id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("submittals")
          .select("id,submittal_number,title,status,due_date,updated_at,assigned_to,company_id,jobs(name)")
          .or(`assigned_to.eq.${user.id},company_id.eq.${currentCompany.id}`)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        setRows((data || []) as unknown as SubmittalRow[]);
      } catch (error: any) {
        console.error("Error loading design professional submittals:", error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load submittals.",
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
      row.submittal_number.toLowerCase().includes(query) ||
      row.title.toLowerCase().includes(query) ||
      (row.jobs?.name || "").toLowerCase().includes(query),
    );
  }, [rows, search]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Submittals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submittal packages assigned to you and your Design Pro company jobs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Submittal Queue
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
            <div className="py-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span className="loading-dots">Loading</span>
            </div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.submittal_number}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{row.jobs?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(row.status)}>{row.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
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
