import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Users, QrCode, UserCircle, ArrowRight } from "lucide-react";

const reports = [
  {
    id: "pin-list",
    title: "PIN Employee Master List",
    description: "Complete list of all PIN employees with their credentials",
    icon: Users,
    path: "/employees/reports/pin-list",
  },
  {
    id: "qr-cards",
    title: "Employee QR Punch Cards",
    description: "Generate customized QR code cards for employees to access punch clock",
    icon: QrCode,
    path: "/employees/reports/qr-cards",
  },
  {
    id: "all-pins",
    title: "All Employees with PIN Access",
    description: "Both regular employees and PIN employees with punch clock access",
    icon: UserCircle,
    path: "/employees/reports/all-pins",
  },
];

export default function EmployeeReports() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employee Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate reports and documents for employees
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(report.path)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardDescription className="mt-2">
                  {report.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
