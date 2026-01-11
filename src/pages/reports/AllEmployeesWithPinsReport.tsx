import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserCircle } from "lucide-react";

interface PinEmployee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  pin_code: string;
  email?: string;
  phone?: string;
}

interface RegularEmployee {
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  pin_code?: string;
  role: string;
}

export default function AllEmployeesWithPinsReport() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [pinEmployees, setPinEmployees] = useState<PinEmployee[]>([]);
  const [regularEmployees, setRegularEmployees] = useState<RegularEmployee[]>([]);
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

      // Fetch PIN employees
      const { data: pinData, error: pinError } = await supabase
        .from("pin_employees")
        .select("id, first_name, last_name, display_name, pin_code, email, phone")
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

      // Fetch regular employees with PINs
      const { data: regularData, error: regularError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, display_name, pin_code, role")
        .not("pin_code", "is", null)
        .order("last_name");

      if (regularError) {
        console.error("Error fetching regular employees:", regularError);
        toast({
          title: "Error",
          description: "Failed to fetch regular employee data",
          variant: "destructive",
        });
      } else {
        setRegularEmployees((regularData as RegularEmployee[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCircle className="h-8 w-8" />
            All Employees with PIN Access
          </h1>
          <p className="text-muted-foreground mt-1">
            Both regular employees and PIN employees with punch clock access
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Regular Employees</CardTitle>
            </CardHeader>
            <CardContent>
              {regularEmployees.length === 0 ? (
                <p className="text-muted-foreground">No regular employees with PINs found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>PIN Code</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regularEmployees.map((employee) => (
                      <TableRow key={employee.user_id}>
                        <TableCell className="font-medium">
                          {employee.last_name}, {employee.first_name}
                        </TableCell>
                        <TableCell>{employee.display_name}</TableCell>
                        <TableCell className="capitalize">{employee.role}</TableCell>
                        <TableCell className="font-mono">{employee.pin_code}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PIN Employees</CardTitle>
            </CardHeader>
            <CardContent>
              {pinEmployees.length === 0 ? (
                <p className="text-muted-foreground">No PIN employees found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>PIN Code</TableHead>
                      <TableHead>Contact</TableHead>
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
                        <TableCell>
                          {employee.email || employee.phone || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
