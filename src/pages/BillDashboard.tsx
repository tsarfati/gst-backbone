import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Clock, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  Eye,
  TrendingUp,
  DollarSign,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Bill statuses will be loaded from database
const billStatuses = {
  waitingApproval: [],
  waitingToBePaid: [],
  overdue: [],
  paid: []
};

const calculateTotal = (bills: any[]) => {
  return 0;
};

export default function BillDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadJobs = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .order('name');
      
      if (!error && data) {
        setJobs(data);
      }
      setLoading(false);
    };
    
    loadJobs();
  }, []);

  const totals = {
    waitingApproval: 0,
    waitingToBePaid: 0,
    overdue: 0,
    paid: 0
  };

  const statusCards = [
    {
      title: "Waiting for Approval",
      count: billStatuses.waitingApproval.length,
      total: totals.waitingApproval,
      icon: Clock,
      variant: "warning" as const,
      description: "Bills pending management approval",
      filter: "approval"
    },
    {
      title: "Waiting to be Paid",
      count: billStatuses.waitingToBePaid.length,
      total: totals.waitingToBePaid,
      icon: CreditCard,
      variant: "default" as const,
      description: "Approved bills ready for payment",
      filter: "pending"
    },
    {
      title: "Overdue",
      count: billStatuses.overdue.length,
      total: totals.overdue,
      icon: AlertTriangle,
      variant: "destructive" as const,
      description: "Bills past due date",
      filter: "overdue"
    },
    {
      title: "Paid",
      count: billStatuses.paid.length,
      total: totals.paid,
      icon: CheckCircle,
      variant: "success" as const,
      description: "Successfully processed bills",
      filter: "paid"
    }
  ];

  const handleStatusCardClick = (filter: string) => {
    navigate(`/invoices?status=${filter}`);
  };

  const selectedJobName = selectedJobId === "all" 
    ? "All Jobs" 
    : jobs.find(job => job.id === selectedJobId)?.name || "Unknown Job";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bill Status Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor bill workflow and payment status{selectedJobId !== "all" && ` for ${selectedJobName}`}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </Button>
          <Button>
            <TrendingUp className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Job Filter Dropdown */}
      <div className="mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Filter by Job:</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    {loading ? (
                      <SelectItem value="loading" disabled>Loading jobs...</SelectItem>
                    ) : (
                      jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {selectedJobId !== "all" && (
                <Badge variant="outline" className="ml-2">
                  Filtered: {selectedJobName}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Counter Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statusCards.map((card) => (
          <Card 
            key={card.title} 
            className="hover-stat cursor-pointer"
            onClick={() => handleStatusCardClick(card.filter)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{card.count}</div>
              <div className="flex items-center justify-between">
                <Badge variant={card.variant}>
                  ${card.total.toLocaleString()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Summary */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-primary" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-xl font-bold">
                  ${(totals.waitingApproval + totals.waitingToBePaid + totals.overdue).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">Paid This Month</p>
                <p className="text-xl font-bold text-success">
                  ${totals.paid.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Payment Progress</span>
                <span>
                  {Math.round((totals.paid / (totals.paid + totals.waitingApproval + totals.waitingToBePaid + totals.overdue)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div 
                  className="bg-success h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.round((totals.paid / (totals.paid + totals.waitingApproval + totals.waitingToBePaid + totals.overdue)) * 100)}%`
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Bill Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: "Bill approved", invoice: "INV-005", vendor: "ABC Materials", time: "2 hours ago", type: "approved" },
              { action: "Payment processed", invoice: "INV-004", vendor: "Office Supply Co", time: "1 day ago", type: "paid" },
              { action: "Bill submitted", invoice: "INV-008", vendor: "Professional Services", time: "1 day ago", type: "submitted" },
              { action: "Payment overdue", invoice: "INV-003", vendor: "Home Depot", time: "2 days ago", type: "overdue" },
            ].filter(activity => {
              // Filter activities based on selected job if needed
              // For now, showing all activities regardless of job filter
              return true;
            }).map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'paid' ? 'bg-success' :
                    activity.type === 'approved' ? 'bg-primary' :
                    activity.type === 'overdue' ? 'bg-destructive' : 'bg-warning'
                  }`} />
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.invoice} • {activity.vendor}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}