import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@supabase/supabase-js";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Download, ArrowLeft, QrCode, Settings } from "lucide-react";
import QRCodeGenerator from "qrcode";
import { jsPDF } from "jspdf";

const SUPABASE_URL = "https://watxvzoolmfjfijrgcvq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q";
const untypedSupabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface PinEmployee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  pin_code: string;
}

interface CardCustomization {
  headerText: string;
  instructionsLine1: string;
  instructionsLine2: string;
  font: string;
  logoUrl: string;
  footerText: string;
}

export default function EmployeeQRCardsReport() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [pinEmployees, setPinEmployees] = useState<PinEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<PinEmployee | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  const [customization, setCustomization] = useState<CardCustomization>({
    headerText: "Employee Punch Clock Card",
    instructionsLine1: "Scan this QR code to access the Punch Clock",
    instructionsLine2: "Then enter your PIN to clock in/out",
    font: "helvetica",
    logoUrl: currentCompany?.logo_url || "",
    footerText: currentCompany?.name || "Company",
  });

  useEffect(() => {
    if (currentCompany) {
      fetchEmployees();
      setCustomization(prev => ({
        ...prev,
        logoUrl: currentCompany.logo_url || "",
        footerText: currentCompany.name || "Company",
      }));
    }
  }, [currentCompany]);

  const fetchEmployees = async () => {
    if (!currentCompany) return;

    setLoading(true);

    try {
      const { data: accessData } = await untypedSupabase
        .from("user_company_access")
        .select("user_id")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true);

      const userIds = (accessData || []).map((a: any) => a.user_id);

      const { data: pinData, error: pinError } = await untypedSupabase
        .from("pin_employees")
        .select("id, first_name, last_name, display_name, pin_code")
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

  const generateEmployeeQRCard = async (employee: PinEmployee) => {
    const doc = new jsPDF();
    doc.setFont(customization.font);
    
    // Add logo if provided
    if (customization.logoUrl) {
      try {
        doc.addImage(customization.logoUrl, "PNG", 85, 10, 40, 20);
      } catch (e) {
        console.warn("Could not add logo to PDF");
      }
    }
    
    // Header
    doc.setFontSize(20);
    doc.text(customization.headerText, 105, customization.logoUrl ? 40 : 20, { align: "center" });
    
    // Employee Info
    doc.setFontSize(14);
    doc.text(`${employee.first_name} ${employee.last_name}`, 105, customization.logoUrl ? 50 : 35, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Display Name: ${employee.display_name}`, 105, customization.logoUrl ? 60 : 45, { align: "center" });
    doc.text(`PIN: ${employee.pin_code}`, 105, customization.logoUrl ? 70 : 55, { align: "center" });
    
    // Generate QR Code
    const punchClockUrl = `${window.location.origin}/punch-clock-login`;
    const qrCodeDataUrl = await QRCodeGenerator.toDataURL(punchClockUrl, {
      width: 200,
      margin: 2,
    });
    
    // Add QR Code
    doc.addImage(qrCodeDataUrl, "PNG", 55, customization.logoUrl ? 85 : 70, 100, 100);
    
    // Instructions
    doc.setFontSize(10);
    doc.text(customization.instructionsLine1, 105, customization.logoUrl ? 195 : 180, { align: "center" });
    doc.text(customization.instructionsLine2, 105, customization.logoUrl ? 203 : 188, { align: "center" });
    
    // Footer
    doc.setFontSize(8);
    doc.text(customization.footerText, 105, 280, { align: "center" });
    
    doc.save(`punch-card-${employee.first_name}-${employee.last_name}.pdf`);
    
    toast({
      title: "Success",
      description: `QR card generated for ${employee.display_name}`,
    });
  };

  const generateAllEmployeeCards = async () => {
    if (pinEmployees.length === 0) return;

    const doc = new jsPDF();
    const punchClockUrl = `${window.location.origin}/punch-clock-login`;

    for (let i = 0; i < pinEmployees.length; i++) {
      const employee = pinEmployees[i];
      
      if (i > 0) {
        doc.addPage();
      }

      doc.setFont(customization.font);
      
      // Add logo if provided
      if (customization.logoUrl) {
        try {
          doc.addImage(customization.logoUrl, "PNG", 85, 10, 40, 20);
        } catch (e) {
          console.warn("Could not add logo to PDF");
        }
      }
      
      // Header
      doc.setFontSize(20);
      doc.text(customization.headerText, 105, customization.logoUrl ? 40 : 20, { align: "center" });
      
      // Employee Info
      doc.setFontSize(14);
      doc.text(`${employee.first_name} ${employee.last_name}`, 105, customization.logoUrl ? 50 : 35, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Display Name: ${employee.display_name}`, 105, customization.logoUrl ? 60 : 45, { align: "center" });
      doc.text(`PIN: ${employee.pin_code}`, 105, customization.logoUrl ? 70 : 55, { align: "center" });
      
      // Generate QR Code
      const qrCodeDataUrl = await QRCodeGenerator.toDataURL(punchClockUrl, {
        width: 200,
        margin: 2,
      });
      
      // Add QR Code
      doc.addImage(qrCodeDataUrl, "PNG", 55, customization.logoUrl ? 85 : 70, 100, 100);
      
      // Instructions
      doc.setFontSize(10);
      doc.text(customization.instructionsLine1, 105, customization.logoUrl ? 195 : 180, { align: "center" });
      doc.text(customization.instructionsLine2, 105, customization.logoUrl ? 203 : 188, { align: "center" });
      
      // Footer
      doc.setFontSize(8);
      doc.text(customization.footerText, 105, 280, { align: "center" });
    }
    
    doc.save(`all-punch-cards-${new Date().toISOString().split("T")[0]}.pdf`);
    
    toast({
      title: "Success",
      description: `Generated ${pinEmployees.length} QR cards`,
    });
  };

  const viewEmployeeQR = async (employee: PinEmployee) => {
    setSelectedEmployee(employee);
    const punchClockUrl = `${window.location.origin}/punch-clock-login`;
    const qrDataUrl = await QRCodeGenerator.toDataURL(punchClockUrl, {
      width: 300,
      margin: 2,
    });
    setQrCodeUrl(qrDataUrl);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <QrCode className="h-8 w-8" />
            Employee QR Punch Cards
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate customized QR code cards for employees
          </p>
        </div>
        <Button onClick={generateAllEmployeeCards} disabled={loading || pinEmployees.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Download All Cards
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Card Customization
          </CardTitle>
          <CardDescription>
            Customize the appearance of the QR punch cards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="headerText">Header Text</Label>
              <Input
                id="headerText"
                value={customization.headerText}
                onChange={(e) => setCustomization({ ...customization, headerText: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="font">Font</Label>
              <Select
                value={customization.font}
                onValueChange={(value) => setCustomization({ ...customization, font: value })}
              >
                <SelectTrigger id="font">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="helvetica">Helvetica</SelectItem>
                  <SelectItem value="times">Times</SelectItem>
                  <SelectItem value="courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructionsLine1">Instructions Line 1</Label>
              <Input
                id="instructionsLine1"
                value={customization.instructionsLine1}
                onChange={(e) => setCustomization({ ...customization, instructionsLine1: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructionsLine2">Instructions Line 2</Label>
              <Input
                id="instructionsLine2"
                value={customization.instructionsLine2}
                onChange={(e) => setCustomization({ ...customization, instructionsLine2: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={customization.logoUrl}
                onChange={(e) => setCustomization({ ...customization, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footerText">Footer Text</Label>
              <Input
                id="footerText"
                value={customization.footerText}
                onChange={(e) => setCustomization({ ...customization, footerText: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
          <CardDescription>
            Select an employee to view or download their QR card
          </CardDescription>
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
                          Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedEmployee && qrCodeUrl && (
        <Card>
          <CardHeader>
            <CardTitle>QR Code Preview</CardTitle>
            <CardDescription>
              {selectedEmployee.display_name} - PIN: {selectedEmployee.pin_code}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            <p className="text-sm text-muted-foreground">
              {customization.instructionsLine1}
            </p>
            <p className="text-sm text-muted-foreground">
              {customization.instructionsLine2}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
