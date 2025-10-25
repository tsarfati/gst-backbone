import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface BillDistributionItem {
  cost_code_id: string;
  cost_code: string;
  description: string;
  percentage: number;
  amount: string;
}

interface BillDistributionSectionProps {
  subcontractDistribution: any[];
  billAmount: string;
  onChange: (distribution: BillDistributionItem[]) => void;
}

export default function BillDistributionSection({
  subcontractDistribution,
  billAmount,
  onChange
}: BillDistributionSectionProps) {
  const [distributionItems, setDistributionItems] = useState<BillDistributionItem[]>([]);

  useEffect(() => {
    // Initialize distribution items from subcontract distribution
    if (subcontractDistribution.length > 0) {
      const items = subcontractDistribution.map(dist => ({
        cost_code_id: dist.cost_code_id,
        cost_code: dist.cost_code,
        description: dist.description,
        percentage: dist.percentage,
        amount: ""
      }));
      setDistributionItems(items);
    }
  }, [subcontractDistribution]);

  useEffect(() => {
    // Auto-calculate amounts based on percentages when bill amount changes
    if (billAmount && parseFloat(billAmount) > 0) {
      const totalBill = parseFloat(billAmount);
      const updatedItems = distributionItems.map(item => ({
        ...item,
        amount: ((totalBill * item.percentage) / 100).toFixed(2)
      }));
      setDistributionItems(updatedItems);
      onChange(updatedItems);
    }
  }, [billAmount]);

  const handleAmountChange = (index: number, value: string) => {
    const updatedItems = [...distributionItems];
    updatedItems[index] = { ...updatedItems[index], amount: value };
    
    // Recalculate percentage
    const totalBill = parseFloat(billAmount) || 0;
    if (totalBill > 0) {
      const amount = parseFloat(value) || 0;
      updatedItems[index].percentage = (amount / totalBill) * 100;
    }
    
    setDistributionItems(updatedItems);
    onChange(updatedItems);
  };

  const getTotalDistributed = () => {
    return distributionItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const getTotalPercentage = () => {
    return distributionItems.reduce((sum, item) => sum + item.percentage, 0);
  };

  const totalDistributed = getTotalDistributed();
  const totalPercentage = getTotalPercentage();
  const billAmountNum = parseFloat(billAmount) || 0;
  const remaining = billAmountNum - totalDistributed;
  const isOverAllocated = totalDistributed > billAmountNum;
  const isUnderAllocated = Math.abs(remaining) > 0.01;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Cost Code Distribution
          {subcontractDistribution.length > 1 && (
            <Badge variant="secondary" className="text-xs">
              {subcontractDistribution.length} Cost Codes
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {distributionItems.map((item, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{item.cost_code}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {item.percentage.toFixed(2)}%
                </Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`amount-${index}`}>Amount</Label>
                <CurrencyInput
                  id={`amount-${index}`}
                  value={item.amount}
                  onChange={(value) => handleAmountChange(index, value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Distribution Summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Bill Amount:</span>
            <span className="font-medium">${billAmountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Total Distributed:</span>
            <span className={`font-medium ${isOverAllocated ? 'text-destructive' : ''}`}>
              ${totalDistributed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Total Percentage:</span>
            <span className="font-medium">{totalPercentage.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-sm font-medium border-t pt-2">
            <span>Remaining:</span>
            <span className={isOverAllocated ? 'text-destructive' : (isUnderAllocated ? 'text-warning' : 'text-success')}>
              ${Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Validation Warnings */}
        {isOverAllocated && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Distribution exceeds bill amount by ${Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
        {!isOverAllocated && isUnderAllocated && (
          <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning rounded-lg">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">
              ${Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2 })} remaining to be distributed
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
