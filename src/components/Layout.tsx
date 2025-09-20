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
  BarChart3
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Upload Receipts", href: "/upload", icon: Receipt },
  { name: "Uncoded Receipts", href: "/uncoded", icon: Clock },
  { name: "Jobs", href: "/jobs", icon: FolderOpen },
  { name: "Vendors", href: "/vendors", icon: Building2 },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Invoice Status", href: "/invoice-status", icon: BarChart3 },
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
            
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link key={item.name} to={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start",
                        isActive && "bg-primary text-primary-foreground"
                      )}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
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