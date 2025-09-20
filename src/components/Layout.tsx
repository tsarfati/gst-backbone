import { Outlet, Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Receipt, 
  FolderOpen, 
  Building2, 
  FileText, 
  LayoutDashboard,
  Clock,
  BarChart3,
  Users,
  FolderArchive,
  Timer,
  MessageSquare,
  CheckSquare,
  Upload
} from "lucide-react";

const navigationCategories = [
  {
    title: "Dashboard",
    items: [
      { name: "Overview", href: "/", icon: LayoutDashboard },
    ]
  },
  {
    title: "Receipts",
    items: [
      { name: "Upload Receipts", href: "/upload", icon: Upload },
      { name: "Uncoded Receipts", href: "/uncoded", icon: Clock },
    ]
  },
  {
    title: "Vendors",
    items: [
      { name: "All Vendors", href: "/vendors", icon: Building2 },
    ]
  },
  {
    title: "Jobs",
    items: [
      { name: "All Jobs", href: "/jobs", icon: FolderOpen },
    ]
  },
  {
    title: "Invoices", 
    items: [
      { name: "All Invoices", href: "/invoices", icon: FileText },
      { name: "Invoice Status", href: "/invoice-status", icon: BarChart3 },
    ]
  },
  {
    title: "Company Files",
    items: [
      { name: "Documents", href: "/company-files", icon: FolderArchive },
    ]
  },
  {
    title: "Employees",
    items: [
      { name: "All Employees", href: "/employees", icon: Users },
    ]
  },
  {
    title: "Punch Clock",
    items: [
      { name: "Time Tracking", href: "/punch-clock", icon: Timer },
    ]
  },
  {
    title: "Messaging",
    items: [
      { name: "Messages", href: "/messaging", icon: MessageSquare },
    ]
  },
  {
    title: "Tasks",
    items: [
      { name: "All Tasks", href: "/tasks", icon: CheckSquare },
    ]
  }
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border">
          <div className="flex flex-col h-full">
            <div className="flex items-center px-6 py-4 border-b border-border">
              <Receipt className="h-6 w-6 text-primary mr-2" />
              <span className="text-lg font-semibold text-foreground">
                ReceiptManager
              </span>
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
              {navigationCategories.map((category) => (
                <div key={category.title}>
                  <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {category.title}
                  </h3>
                  <div className="space-y-1">
                    {category.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link key={item.name} to={item.href}>
                          <Button
                            variant={isActive ? "default" : "ghost"}
                            className={cn(
                              "w-full justify-start h-9",
                              isActive && "bg-primary text-primary-foreground"
                            )}
                          >
                            <item.icon className="mr-3 h-4 w-4" />
                            {item.name}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}