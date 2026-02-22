import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Download, ArrowLeft, QrCode, Settings, Save } from "lucide-react";
import QRCodeGenerator from "qrcode";
import { jsPDF } from "jspdf";

interface PinEmployee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
}

interface CardCustomization {
  baseUrl: string;
  headerText: string;
  instructions: string;
  font: string;
  logoUrl: string;
  logoScale: number;
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
  const [previewQrCode, setPreviewQrCode] = useState<string>("");
  
  const [customization, setCustomization] = useState<CardCustomization>({
    baseUrl: window.location.origin,
    headerText: "Employee Punch Clock Card",
    instructions: "Scan this QR code to access the Punch Clock<br>Then enter your PIN to clock in/out",
    font: "helvetica",
    logoUrl: currentCompany?.logo_url || "",
    logoScale: 1.0,
    footerText: currentCompany?.name || "Company",
  });
  

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomization({ ...customization, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };


  useEffect(() => {
    if (currentCompany) {
      fetchEmployees();
      loadSavedCustomization();
    }
  }, [currentCompany]);

  useEffect(() => {
    const generatePreviewQR = async () => {
      const punchClockUrl = `${customization.baseUrl}/punch-clock-login`;
      const qrDataUrl = await QRCodeGenerator.toDataURL(punchClockUrl, {
        width: 200,
        margin: 2,
      });
      setPreviewQrCode(qrDataUrl);
    };
    generatePreviewQR();
  }, [customization.baseUrl]);

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

      if (userIds.length === 0) {
        setPinEmployees([]);
        return;
      }

      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, display_name, punch_clock_access")
        .in("user_id", userIds)
        .eq("punch_clock_access", true)
        .order("last_name");

      if (error) {
        console.error("Error fetching employees:", error);
        toast({
          title: "Error",
          description: "Failed to fetch employee data",
          variant: "destructive",
        });
      } else {
        const employees: PinEmployee[] = (profilesData || []).map((p: any) => ({
          id: p.user_id,
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        }));
        setPinEmployees(employees);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCustomization = async () => {
    if (!currentCompany) return;

    const { data, error } = await supabase
      .from("qr_card_customization")
      .select("*")
      .eq("company_id", currentCompany.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading customization:", error);
      return;
    }

    if (data) {
      setCustomization({
        baseUrl: data.base_url,
        headerText: data.header_text,
        instructions: data.instructions || "Scan this QR code to access the Punch Clock<br>Then enter your PIN to clock in/out",
        font: data.font,
        logoUrl: data.logo_url || "",
        logoScale: data.logo_scale || 1.0,
        footerText: data.footer_text,
      });
    }
  };

  const saveCustomization = async () => {
    if (!currentCompany) return;

    const { error } = await supabase
      .from("qr_card_customization")
      .upsert({
        company_id: currentCompany.id,
        base_url: customization.baseUrl,
        header_text: customization.headerText,
        instructions: customization.instructions,
        font: customization.font,
        logo_url: customization.logoUrl,
        logo_scale: customization.logoScale,
        footer_text: customization.footerText,
      }, {
        onConflict: "company_id"
      });

    if (error) {
      console.error("Error saving customization:", error);
      toast({
        title: "Error",
        description: "Failed to save customization settings",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Customization settings saved",
      });
    }
  };

  const generateEmployeeQRCard = async (employee: PinEmployee) => {
    const doc = new jsPDF();
    doc.setFont(customization.font);
    
    // Add logo if provided (40mm base width, scaled by logoScale)
    if (customization.logoUrl) {
      try {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const aspectRatio = img.naturalHeight / img.naturalWidth;
            const logoWidth = 40 * customization.logoScale;
            const logoHeight = logoWidth * aspectRatio;
            const xPos = 105 - (logoWidth / 2); // Center the logo
            doc.addImage(img as HTMLImageElement, "PNG", xPos, 10, logoWidth, logoHeight);
            resolve();
          };
          img.onerror = () => reject(new Error("Failed to load logo"));
          img.src = customization.logoUrl;
        });
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
    doc.text(`ID: ${employee.id.slice(0, 8)}`, 105, customization.logoUrl ? 70 : 55, { align: "center" });
    
    // Generate QR Code - use configured base URL
    const punchClockUrl = `${customization.baseUrl}/punch-clock-login`;
    const qrCodeDataUrl = await QRCodeGenerator.toDataURL(punchClockUrl, {
      width: 200,
      margin: 2,
    });
    
    // Add QR Code
    doc.addImage(qrCodeDataUrl, "PNG", 55, customization.logoUrl ? 85 : 70, 100, 100);
    
    // Instructions - parse HTML and render as text lines
    doc.setFontSize(10);
    const instructionLines = customization.instructions
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n');
    let yPos = customization.logoUrl ? 195 : 180;
    instructionLines.forEach((line) => {
      doc.text(line, 105, yPos, { align: "center" });
      yPos += 8;
    });
    
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
    const punchClockUrl = `${customization.baseUrl}/punch-clock-login`;

    for (let i = 0; i < pinEmployees.length; i++) {
      const employee = pinEmployees[i];
      
      if (i > 0) {
        doc.addPage();
      }

      doc.setFont(customization.font);
      
      // Add logo if provided (40mm base width, scaled by logoScale)
      if (customization.logoUrl) {
        try {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.naturalHeight / img.naturalWidth;
              const logoWidth = 40 * customization.logoScale;
              const logoHeight = logoWidth * aspectRatio;
              const xPos = 105 - (logoWidth / 2); // Center the logo
              doc.addImage(img as HTMLImageElement, "PNG", xPos, 10, logoWidth, logoHeight);
              resolve();
            };
            img.onerror = () => reject(new Error("Failed to load logo"));
            img.src = customization.logoUrl;
          });
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
      doc.text(`ID: ${employee.id.slice(0, 8)}`, 105, customization.logoUrl ? 70 : 55, { align: "center" });
      
      // Generate QR Code
      const qrCodeDataUrl = await QRCodeGenerator.toDataURL(punchClockUrl, {
        width: 200,
        margin: 2,
      });
      
      // Add QR Code
      doc.addImage(qrCodeDataUrl, "PNG", 55, customization.logoUrl ? 85 : 70, 100, 100);
      
      // Instructions - parse HTML and render as text lines
      doc.setFontSize(10);
      const instructionLines = customization.instructions
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .split('\n');
      let yPos = customization.logoUrl ? 195 : 180;
      instructionLines.forEach((line) => {
        doc.text(line, 105, yPos, { align: "center" });
        yPos += 8;
      });
      
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
    const punchClockUrl = `${customization.baseUrl}/punch-clock-login`;
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
        <div className="flex gap-2">
          <Button onClick={saveCustomization} variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
          <Button onClick={generateAllEmployeeCards} disabled={loading || pinEmployees.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Download All Cards
          </Button>
        </div>
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
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Important: QR Code URL Configuration</p>
            <p className="text-sm text-muted-foreground">
              The Base URL below determines where the QR codes will point. Use your deployed production URL (e.g., https://yourapp.com) for QR codes that employees will scan. The preview URL won't work for scanning.
            </p>
          </div>
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="baseUrl">Base URL (Production URL)</Label>
              <Input
                id="baseUrl"
                value={customization.baseUrl}
                onChange={(e) => setCustomization({ ...customization, baseUrl: e.target.value })}
                placeholder="https://yourapp.com"
              />
              <p className="text-xs text-muted-foreground">
                This is the URL that will be encoded in the QR codes. Use your deployed production URL.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="instructions">Instructions (HTML supported)</Label>
              <textarea
                id="instructions"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={customization.instructions}
                onChange={(e) => setCustomization({ ...customization, instructions: e.target.value })}
                placeholder="Scan this QR code<br>to access the Punch Clock"
              />
              <p className="text-xs text-muted-foreground">
                Use &lt;br&gt; for line breaks, &lt;b&gt; for bold, &lt;i&gt; for italic
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUpload">Company Logo</Label>
              <Input
                id="logoUpload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
              />
              {customization.logoUrl && (
                <div className="mt-2">
                  <img 
                    src={customization.logoUrl} 
                    alt="Logo preview" 
                    style={{ width: `${40 * customization.logoScale}mm`, height: 'auto' }} 
                    className="object-contain" 
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoScale">Logo Scale: {customization.logoScale.toFixed(1)}x</Label>
              <input
                id="logoScale"
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={customization.logoScale}
                onChange={(e) => setCustomization({ ...customization, logoScale: parseFloat(e.target.value) })}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Adjust logo size from 0.5x to 2.0x
              </p>
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
          <CardTitle>Card Preview</CardTitle>
          <CardDescription>
            Preview of how the QR punch cards will appear
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div className="border-2 border-border rounded-lg p-8 bg-background shadow-lg" style={{ width: '400px' }}>
              {customization.logoUrl && (
                <div className="flex justify-center mb-4">
                  <img 
                    src={customization.logoUrl} 
                    alt="Company Logo" 
                    style={{ width: `${40 * customization.logoScale}mm`, height: 'auto' }} 
                    className="object-contain" 
                  />
                </div>
              )}
              <h2 className="text-xl font-bold text-center mb-3" style={{ fontFamily: customization.font }}>
                {customization.headerText}
              </h2>
              <div className="text-center mb-2">
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">Display Name: John D.</p>
                <p className="text-xs text-muted-foreground font-mono">PIN: 1234</p>
              </div>
              {previewQrCode && (
                <div className="flex justify-center my-4">
                  <img src={previewQrCode} alt="QR Code Preview" className="w-48 h-48" />
                </div>
              )}
              <div 
                className="text-center space-y-1 text-xs text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: customization.instructions }}
              />
              <p className="text-xs text-center text-muted-foreground mt-4" style={{ fontFamily: customization.font }}>
                {customization.footerText}
              </p>
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
                    <TableCell className="font-mono">{employee.id.slice(0, 8)}</TableCell>
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
              {selectedEmployee.display_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            <div 
              className="text-sm text-muted-foreground text-center"
              dangerouslySetInnerHTML={{ __html: customization.instructions }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
