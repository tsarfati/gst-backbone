import { Clock, FileText, QrCode, ShieldAlert, Users } from "lucide-react";
import ReportCatalogPage, { type ReportCatalogItem } from "@/components/ReportCatalogPage";

export default function EmployeeReports() {
  const reports: ReportCatalogItem[] = [
    {
      key: "timecard-reports",
      title: "Timecard Reports",
      description: "Review employee timecards, punches, and timesheet summaries",
      icon: Clock,
      to: "/punch-clock/reports",
      isBuilt: true,
    },
    {
      key: "employee-qr-cards",
      title: "Employee QR Cards",
      description: "Generate printable employee QR cards for punch clock check-in",
      icon: QrCode,
      to: "/employees/reports/qr-cards",
      isBuilt: true,
    },
    {
      key: "pin-employee-list",
      title: "PIN Employee List",
      description: "Printable/exportable list of PIN-based punch clock employees",
      icon: Users,
      to: "/employees/reports/pin-list",
      isBuilt: true,
    },
    {
      key: "punch-clock-attempt-audit",
      title: "Punch Clock Attempt Audit",
      description: "Audit blocked and warning punch attempts (geofence, location, job settings)",
      icon: ShieldAlert,
      to: "/employees/reports/punch-clock-attempt-audit",
      isBuilt: true,
    },
    {
      key: "employee-performance",
      title: "Employee Performance",
      description: "Performance metrics and productivity summaries by employee",
      icon: FileText,
      to: "/employees/performance",
      isBuilt: true,
    },
  ];

  return (
    <ReportCatalogPage
      title="Employee Reports"
      description="Access employee, punch clock, and workforce reporting tools"
      reports={reports}
      favoriteScope="employee"
      viewPreferenceKey="employee-reports-view"
      containerClassName="p-6 max-w-7xl mx-auto space-y-6"
    />
  );
}
