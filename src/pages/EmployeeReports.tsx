import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@supabase/supabase-js";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Download, Users, UserCircle, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Create untyped client to avoid deep type instantiation errors
const SUPABASE_URL = "https://watxvzoolmfjfijrgcvq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q";
const untypedSupabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

interface RegularEmployee {
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  pin_code?: string;
  role: string;
}

export default function EmployeeReports() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [pinEmployees, setPinEmployees] = useState<PinEmployee[]>([]);
  const [regularEmployees, setRegularEmployees] = useState<RegularEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<PinEmployee | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    if (currentCompany) {
      fetchEmployees();
    }
  }, [currentCompany]);

  const fetchEmployees = async () => {
    if (!currentCompany) return;

    setLoading(true);

    try {
      // Get users with access to current company
      const { data: accessData } = await untypedSupabase
        .from("user_company_access")
        .select("user_id")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true);

      const userIds = (accessData || []).map((a: any) => a.user_id);

      // Fetch PIN employees using untyped client
      const { data: pinData, error: pinError } = await untypedSupabase
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

      // Fetch regular employees with PINs
      const { data: regularData, error: regularError } = await untypedSupabase
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

  const generatePinListPDF = async () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text("PIN Employee List", 14, 20);
    
    doc.setFontSize(11);
    doc.text(currentCompany?.name || "Company", 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

    // Prepare table data
    const tableData = pinEmployees.map((emp) => [
      emp.last_name,
      emp.first_name,
      emp.display_name,
      emp.pin_code,
      emp.email || "N/A",
      emp.phone || "N/A",
    ]);

    // Add table
    autoTable(doc, {
      startY: 40,
      head: [["Last Name", "First Name", "Display Name", "PIN Code", "Email", "Phone"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Save PDF
    doc.save(`pin-employees-${new Date().toISOString().split("T")[0]}.pdf`);

    toast({
      title: "Success",
      description: "PIN employee list downloaded",
    });
  };

  const generateEmployeeQRCard = async (employee: PinEmployee) => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text("Employee Punch Clock Card", 105, 20, { align: "center" });
    
    // Employee Info
    doc.setFontSize(14);
    doc.text(`${employee.first_name} ${employee.last_name}`, 105, 35, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Display Name: ${employee.display_name}`, 105, 45, { align: "center" });
    doc.text(`PIN: ${employee.pin_code}`, 105, 55, { align: "center" });
    
    // Generate QR Code
    const punchClockUrl = `${window.location.origin}/punch-clock-login`;
    const qrCodeDataUrl = await QRCode.toDataURL(punchClockUrl, {
      width: 200,
      margin: 2,
    });
    
    // Add QR Code
    doc.addImage(qrCodeDataUrl, "PNG", 55, 70, 100, 100);
    
    // Instructions
    doc.setFontSize(10);
    doc.text("Scan this QR code to access the Punch Clock", 105, 180, { align: "center" });
    doc.text("Then enter your PIN to clock in/out", 105, 188, { align: "center" });
    
    // Company info
    doc.setFontSize(8);
    doc.text(currentCompany?.name || "Company", 105, 280, { align: "center" });
    
    // Save
    doc.save(`punch-card-${employee.first_name}-${employee.last_name}.pdf`);
    
    toast({
      title: "Success",
      description: `QR card generated for ${employee.display_name}`,
    });
  };

  const viewEmployeeQR = async (employee: PinEmployee) => {
    setSelectedEmployee(employee);
    const punchClockUrl = `${window.location.origin}/punch-clock-login`;
    const qrDataUrl = await QRCode.toDataURL(punchClockUrl, {
      width: 300,
      margin: 2,
    });
    setQrCodeUrl(qrDataUrl);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate reports and documents for employees
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* PIN Employee List Report */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  PIN Employee Master List
                </CardTitle>
                <CardDescription className="mt-1">
                  Complete list of all PIN employees with their credentials
                </CardDescription>
              </div>
              <Button onClick={generatePinListPDF} disabled={loading || pinEmployees.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
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

        {/* Employee QR Cards Report */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              <div>
                <CardTitle>Employee QR Punch Cards</CardTitle>
                <CardDescription className="mt-1">
                  Generate individual QR code cards for employees to access punch clock
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : pinEmployees.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No PIN employees found</p>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>PIN Code</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pinEmployees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                          {employee.display_name}
                        </TableCell>
                        <TableCell className="font-mono">{employee.pin_code}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewEmployeeQR(employee)}
                            >
                              <QrCode className="h-4 w-4 mr-2" />
                              View QR
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => generateEmployeeQRCard(employee)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Card
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {selectedEmployee && qrCodeUrl && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>QR Code Preview</CardTitle>
                      <CardDescription>
                        {selectedEmployee.display_name} - PIN: {selectedEmployee.pin_code}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center space-y-4">
                      <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                      <p className="text-sm text-muted-foreground">
                        Scan to access Punch Clock Login
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Employees with PINs Report */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              <div>
                <CardTitle>All Employees with PIN Access</CardTitle>
                <CardDescription className="mt-1">
                  Both regular employees and PIN employees with punch clock access
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Regular Employees</h3>
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
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">PIN Employees</h3>
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
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
