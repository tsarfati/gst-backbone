import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Download, ArrowLeft, Users, Mail } from "lucide-react";
import ReportEmailModal from "@/components/ReportEmailModal";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface EmployeeWithPin {
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  pin_code: string;
  phone?: string;
  punch_clock_access: boolean;
  pm_lynk_access: boolean;
}

export default function PinEmployeeListReport() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeWithPin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) fetchEmployees();
  }, [currentCompany]);

  const fetchEmployees = async () => {
    if (!currentCompany) return;
    setLoading(true);

    try {
      // Get employee user IDs for this company
      const { data: accessData } = await supabase
        .from("user_company_access")
        .select("user_id")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true);

      const userIds = (accessData || []).map((a: any) => a.user_id);
      if (userIds.length === 0) { setEmployees([]); return; }

      // Fetch profiles with PINs
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, display_name, pin_code, phone, punch_clock_access, pm_lynk_access")
        .in("user_id", userIds)
        .not("pin_code", "is", null)
        .order("last_name");

      if (error) {
        toast({ title: "Error", description: "Failed to fetch employee data", variant: "destructive" });
      } else {
        setEmployees((profileData as EmployeeWithPin[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const buildPdfDoc = async () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Employee PIN Access Report", 14, 20);
    doc.setFontSize(11);
    doc.text(currentCompany?.name || "Company", 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

    const tableData = employees.map((emp) => [
      emp.last_name,
      emp.first_name,
      emp.display_name,
      emp.pin_code,
      emp.phone || "N/A",
      emp.punch_clock_access ? "Yes" : "No",
      emp.pm_lynk_access ? "Yes" : "No",
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Last Name", "First Name", "Display Name", "PIN Code", "Phone", "Punch Clock", "PM Lynk"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });

    return doc;
  };

  const generatePDF = async () => {
    const doc = await buildPdfDoc();
    doc.save(`employee-pin-report-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Success", description: "Report downloaded" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Employee PIN Access Report
          </h1>
          <p className="text-muted-foreground mt-1">
            All employees with PIN access for punch clock and mobile apps
          </p>
        </div>
        <Button onClick={generatePDF} disabled={loading || employees.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        <Button variant="outline" onClick={() => setEmailModalOpen(true)} disabled={loading || employees.length === 0}>
          <Mail className="h-4 w-4 mr-2" />
          Email
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : employees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No employees with PIN access found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>PIN Code</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Punch Clock</TableHead>
                  <TableHead>PM Lynk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.user_id}>
                    <TableCell className="font-medium">
                      {employee.last_name}, {employee.first_name}
                    </TableCell>
                    <TableCell>{employee.display_name}</TableCell>
                    <TableCell className="font-mono">{employee.pin_code}</TableCell>
                    <TableCell>{employee.phone || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={employee.punch_clock_access ? "default" : "outline"}>
                        {employee.punch_clock_access ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.pm_lynk_access ? "default" : "outline"}>
                        {employee.pm_lynk_access ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReportEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        generatePdf={buildPdfDoc}
        reportName="Employee PIN Access Report"
        fileName={`employee-pin-report-${new Date().toISOString().split("T")[0]}.pdf`}
      />
    </div>
  );
}
