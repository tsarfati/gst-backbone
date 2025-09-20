import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, Clock, CheckCircle, DollarSign } from "lucide-react";

export default function Dashboard() {
  const stats = [
    {
      title: "Uncoded Receipts",
      value: "12",
      icon: Clock,
      variant: "warning" as const,
    },
    {
      title: "Total Receipts",
      value: "247",
      icon: Receipt,
      variant: "default" as const,
    },
    {
      title: "Completed Jobs",
      value: "8",
      icon: CheckCircle,
      variant: "success" as const,
    },
    {
      title: "Pending Invoices",
      value: "$12,450",
      icon: DollarSign,
      variant: "destructive" as const,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your receipt and invoice management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <Badge variant={stat.variant} className="mt-2">
                {stat.variant === "warning" && "Needs Attention"}
                {stat.variant === "success" && "Up to Date"}
                {stat.variant === "destructive" && "Overdue"}
                {stat.variant === "default" && "Active"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "Receipt uploaded", job: "Office Renovation", time: "2 hours ago" },
                { action: "Invoice paid", vendor: "ABC Supplies", time: "4 hours ago" },
                { action: "Cost code assigned", job: "Warehouse Project", time: "1 day ago" },
              ].map((activity, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.job || activity.vendor}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Office Renovation", receipts: 8, budget: "$25,000" },
                { name: "Warehouse Project", receipts: 15, budget: "$50,000" },
                { name: "Retail Buildout", receipts: 4, budget: "$15,000" },
              ].map((job, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{job.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.receipts} receipts • {job.budget} budget
                    </p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}