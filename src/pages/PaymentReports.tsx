import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  Download, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  FileText,
  PieChart
} from "lucide-react";
import { useState } from "react";

const monthlyData: any[] = [];
const vendorPayments: any[] = [];
const paymentMethods: any[] = [];

export default function PaymentReports() {
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [reportType, setReportType] = useState("summary");

  const currentMonthTotal = 0;
  const previousMonthTotal = 0;
  const monthOverMonth = "0.0";
  const isPositiveGrowth = false;

  const totalYearToDate = 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Reports</h1>
          <p className="text-muted-foreground">
            Analyze payment trends, vendor spending, and financial insights
          </p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments YTD</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <div className="flex items-center text-sm mt-2">
              <TrendingUp className="h-3 w-3 text-muted-foreground mr-1" />
              <span className="text-muted-foreground">No data available</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Payment Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <Badge variant="default" className="mt-2">
              Per invoice
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 days</div>
            <Badge variant="default" className="mt-2">
              No data
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <Badge variant="default" className="mt-2">
              This period
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Monthly Payment Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((month, index) => (
                <div key={month.month} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{month.month}</p>
                    <p className="text-sm text-muted-foreground">
                      {month.invoiceCount} invoices • {month.avgProcessTime} avg
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${month.totalPaid.toLocaleString()}</p>
                    <div className="w-24 bg-accent rounded-full h-2 mt-1">
                      <div 
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(month.totalPaid / Math.max(...monthlyData.map(m => m.totalPaid))) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Vendors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Top Vendors by Payment Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vendorPayments.map((vendor, index) => (
                <div key={vendor.vendor} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{vendor.vendor}</p>
                      <p className="text-sm text-muted-foreground">
                        {vendor.invoiceCount} invoices
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${vendor.totalPaid.toLocaleString()}</p>
                    <Badge variant="default" className="text-xs">
                      {vendor.percentage}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {paymentMethods.map((method) => (
              <div key={method.method} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{method.method}</p>
                  <Badge variant="outline">{method.percentage}%</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Count:</span>
                    <span className="font-medium">{method.count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Amount:</span>
                    <span className="font-medium">${method.avgAmount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-accent rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${method.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Generate Custom Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto flex-col p-4">
              <FileText className="h-6 w-6 mb-2" />
              <span className="font-medium">Vendor Summary</span>
              <span className="text-xs text-muted-foreground">Payment totals by vendor</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4">
              <BarChart3 className="h-6 w-6 mb-2" />
              <span className="font-medium">Monthly Analysis</span>
              <span className="text-xs text-muted-foreground">Monthly payment trends</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4">
              <Calendar className="h-6 w-6 mb-2" />
              <span className="font-medium">Custom Period</span>
              <span className="text-xs text-muted-foreground">Select date range</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}