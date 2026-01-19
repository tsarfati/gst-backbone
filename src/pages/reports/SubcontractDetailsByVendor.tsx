import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Download, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportAoAToXlsx } from "@/utils/exceljsExport";
import { format } from "date-fns";

interface Subcontract {
  id: string;
  name: string;
  job_name: string;
  contract_amount: number;
  status: string;
  invoiced_amount: number;
  paid_amount: number;
}

interface VendorGroup {
  vendor_id: string;
  vendor_name: string;
  subcontracts: Subcontract[];
  totals: {
    contract: number;
    invoiced: number;
    paid: number;
  };
}

export default function SubcontractDetailsByVendor() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      loadData();
    }
  }, [currentCompany?.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: subs, error } = await supabase
        .from("subcontracts")
        .select(`
          id, name, contract_amount, status, vendor_id,
          vendors!inner(id, name),
          jobs!inner(name, company_id)
        `)
        .eq("jobs.company_id", currentCompany!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by vendor
      const vendorMap = new Map<string, VendorGroup>();

      for (const sub of subs || []) {
        const vendorId = (sub as any).vendors?.id;
        const vendorName = (sub as any).vendors?.name || "Unknown Vendor";

        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            vendor_id: vendorId,
            vendor_name: vendorName,
            subcontracts: [],
            totals: { contract: 0, invoiced: 0, paid: 0 },
          });
        }

        // Get invoiced amount for this subcontract
        const { data: invoices } = await supabase
          .from("invoices")
          .select("amount")
          .eq("subcontract_id", sub.id);

        const invoicedAmount = (invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);

        const group = vendorMap.get(vendorId)!;
        const subcontractEntry: Subcontract = {
          id: sub.id,
          name: sub.name,
          job_name: (sub as any).jobs?.name || "-",
          contract_amount: sub.contract_amount || 0,
          status: sub.status || "draft",
          invoiced_amount: invoicedAmount,
          paid_amount: 0, // Would require payment tracking
        };

        group.subcontracts.push(subcontractEntry);
        group.totals.contract += subcontractEntry.contract_amount;
        group.totals.invoiced += subcontractEntry.invoiced_amount;
      }

      // Convert map to array and sort by vendor name
      const groups = Array.from(vendorMap.values()).sort((a, b) => 
        a.vendor_name.localeCompare(b.vendor_name)
      );

      setVendorGroups(groups);
      // Expand first vendor by default
      if (groups.length > 0) {
        setExpandedVendors(new Set([groups[0].vendor_id]));
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load subcontract details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleVendor = (vendorId: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };

  const grandTotals = vendorGroups.reduce(
    (acc, group) => ({
      contract: acc.contract + group.totals.contract,
      invoiced: acc.invoiced + group.totals.invoiced,
      paid: acc.paid + group.totals.paid,
    }),
    { contract: 0, invoiced: 0, paid: 0 }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "completed": return "bg-blue-100 text-blue-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    doc.setFontSize(18);
    doc.text("Subcontract Details by Vendor", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 28);
    doc.text(`Company: ${currentCompany?.name || ""}`, 14, 34);
    
    let yPos = 44;
    
    vendorGroups.forEach((group) => {
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(group.vendor_name, 14, yPos);
      yPos += 6;
      
      const tableData = group.subcontracts.map(sub => [
        sub.name,
        sub.job_name,
        sub.status,
        `$${formatNumber(sub.contract_amount)}`,
        `$${formatNumber(sub.invoiced_amount)}`,
        `$${formatNumber(sub.contract_amount - sub.invoiced_amount)}`,
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [["Subcontract", "Project", "Status", "Contract", "Invoiced", "Remaining"]],
        body: tableData,
        foot: [["", "", "Subtotal:", 
          `$${formatNumber(group.totals.contract)}`,
          `$${formatNumber(group.totals.invoiced)}`,
          `$${formatNumber(group.totals.contract - group.totals.invoiced)}`
        ]],
        theme: "grid",
        headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
        margin: { left: 14 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 10;
    });
    
    doc.save(`subcontract-details-by-vendor-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportToExcel = async () => {
    const worksheetData: any[][] = [
      ["Subcontract Details by Vendor"],
      [`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`],
      [`Company: ${currentCompany?.name || ""}`],
      [],
    ];

    vendorGroups.forEach((group) => {
      worksheetData.push([group.vendor_name]);
      worksheetData.push(["Subcontract", "Project", "Status", "Contract", "Invoiced", "Remaining"]);

      group.subcontracts.forEach((sub) => {
        worksheetData.push([
          sub.name,
          sub.job_name,
          sub.status,
          sub.contract_amount,
          sub.invoiced_amount,
          sub.contract_amount - sub.invoiced_amount,
        ]);
      });

      worksheetData.push([
        "",
        "",
        "Subtotal:",
        group.totals.contract,
        group.totals.invoiced,
        group.totals.contract - group.totals.invoiced,
      ]);
      worksheetData.push([]);
    });

    worksheetData.push([
      "",
      "",
      "Grand Total:",
      grandTotals.contract,
      grandTotals.invoiced,
      grandTotals.contract - grandTotals.invoiced,
    ]);

    try {
      await exportAoAToXlsx({
        data: worksheetData,
        sheetName: "By Vendor",
        fileName: `subcontract-details-by-vendor-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
      });
      toast({ title: "Success", description: "Excel file exported successfully" });
    } catch (e) {
      console.error("Excel export failed:", e);
      toast({ title: "Error", description: "Failed to export Excel file", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Subcontract Details by Vendor</h1>
            <p className="text-muted-foreground text-sm">Subcontract information organized by vendor</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={loading || vendorGroups.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={loading || vendorGroups.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendorGroups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(grandTotals.contract)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(grandTotals.invoiced)}</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
        </Card>
      ) : vendorGroups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No subcontracts found</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vendorGroups.map((group) => (
            <Card key={group.vendor_id}>
              <Collapsible
                open={expandedVendors.has(group.vendor_id)}
                onOpenChange={() => toggleVendor(group.vendor_id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedVendors.has(group.vendor_id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <span>{group.vendor_name}</span>
                        <Badge variant="secondary">{group.subcontracts.length} subcontracts</Badge>
                      </div>
                      <span className="text-sm font-normal text-muted-foreground">
                        Total: ${formatNumber(group.totals.contract)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subcontract</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Contract</TableHead>
                          <TableHead className="text-right">Invoiced</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.subcontracts.map((sub) => (
                          <TableRow 
                            key={sub.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/subcontracts/${sub.id}`)}
                          >
                            <TableCell className="font-medium">{sub.name}</TableCell>
                            <TableCell>{sub.job_name}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(sub.status)}>{sub.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">${formatNumber(sub.contract_amount)}</TableCell>
                            <TableCell className="text-right">${formatNumber(sub.invoiced_amount)}</TableCell>
                            <TableCell className="text-right font-medium">
                              ${formatNumber(sub.contract_amount - sub.invoiced_amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell colSpan={3}>Subtotal</TableCell>
                          <TableCell className="text-right">${formatNumber(group.totals.contract)}</TableCell>
                          <TableCell className="text-right">${formatNumber(group.totals.invoiced)}</TableCell>
                          <TableCell className="text-right">
                            ${formatNumber(group.totals.contract - group.totals.invoiced)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
