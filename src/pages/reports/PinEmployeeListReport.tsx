import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Download, ArrowLeft, Users } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface PinEmployee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  pin_code: string;
  email?: string;
  phone?: string;
  is_active: boolean;
}

export default function PinEmployeeListReport() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [pinEmployees, setPinEmployees] = useState<PinEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      fetchEmployees();
    }
  }, [currentCompany]);

  const fetchEmployees = async () => {
    if (!currentCompany) return;

    setLoading(true);

    try {
      const { data: accessData } = await supabase
        .from("user_company_access")
        .select("user_id")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true);

      const userIds = (accessData || []).map((a: any) => a.user_id);

      const { data: pinData, error: pinError } = await supabase
        .from("pin_employees")
        .select("id, first_name, last_name, display_name, pin_code, email, phone, is_active")
        .in("id", userIds)
        .eq("is_active", true)
        .order("last_name");

      if (pinError) {
        console.error("Error fetching PIN employees:", pinError);
        toast({
          title: "Error",
          description: "Failed to fetch PIN employee data",
          variant: "destructive",
        });
      } else {
        setPinEmployees((pinData as PinEmployee[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const generatePinListPDF = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("PIN Employee List", 14, 20);
    
    doc.setFontSize(11);
    doc.text(currentCompany?.name || "Company", 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

    const tableData = pinEmployees.map((emp) => [
      emp.last_name,
      emp.first_name,
      emp.display_name,
      emp.pin_code,
      emp.email || "N/A",
      emp.phone || "N/A",
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Last Name", "First Name", "Display Name", "PIN Code", "Email", "Phone"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`pin-employees-${new Date().toISOString().split("T")[0]}.pdf`);

    toast({
      title: "Success",
      description: "PIN employee list downloaded",
    });
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
            PIN Employee Master List
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete list of all PIN employees with their credentials
          </p>
        </div>
        <Button onClick={generatePinListPDF} disabled={loading || pinEmployees.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : pinEmployees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No PIN employees found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>PIN Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pinEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.last_name}, {employee.first_name}
                    </TableCell>
                    <TableCell>{employee.display_name}</TableCell>
                    <TableCell className="font-mono">{employee.pin_code}</TableCell>
                    <TableCell>{employee.email || "N/A"}</TableCell>
                    <TableCell>{employee.phone || "N/A"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
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
