import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Receipt, DollarSign, Calendar, Plus } from "lucide-react";

const mockJobs = [
  {
    id: "1",
    name: "Office Renovation",
    budget: "$25,000",
    spent: "$18,450",
    receipts: 8,
    startDate: "2024-01-01",
    status: "active"
  },
  {
    id: "2",
    name: "Warehouse Project",
    budget: "$50,000",
    spent: "$32,100",
    receipts: 15,
    startDate: "2023-12-15",
    status: "active"
  },
  {
    id: "3",
    name: "Retail Buildout",
    budget: "$15,000",
    spent: "$14,800",
    receipts: 4,
    startDate: "2024-01-10",
    status: "completed"
  },
];

export default function Jobs() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-muted-foreground">
            Manage projects and view associated receipts
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockJobs.map((job) => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg">
                  <FolderOpen className="h-5 w-5 mr-2 text-primary" />
                  {job.name}
                </CardTitle>
                <Badge 
                  variant={job.status === "active" ? "default" : "success"}
                >
                  {job.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Budget
                  </div>
                  <div className="font-semibold">{job.budget}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Spent
                  </div>
                  <div className="font-semibold">{job.spent}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Receipt className="h-3 w-3 mr-1" />
                    Receipts
                  </div>
                  <div className="font-semibold">{job.receipts}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    Started
                  </div>
                  <div className="font-semibold">{job.startDate}</div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>Budget Usage</span>
                  <span>
                    {Math.round((parseInt(job.spent.replace(/[$,]/g, '')) / parseInt(job.budget.replace(/[$,]/g, ''))) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-accent rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (parseInt(job.spent.replace(/[$,]/g, '')) / parseInt(job.budget.replace(/[$,]/g, ''))) * 100)}%`
                    }}
                  />
                </div>
              </div>

              <Button variant="outline" className="w-full">
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}