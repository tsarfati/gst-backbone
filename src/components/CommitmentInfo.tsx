import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CommitmentInfoProps {
  totalCommit: number;
  prevGross: number;
  prevRetention: number;
  prevPayments: number;
  contractBalance: number;
  className?: string;
}

export default function CommitmentInfo({
  totalCommit,
  prevGross,
  prevRetention,
  prevPayments,
  contractBalance,
  className = ""
}: CommitmentInfoProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Commitment Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Commit:</span>
          <span className="font-medium">{formatCurrency(totalCommit)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Prev Gross:</span>
          <span className="font-medium">{formatCurrency(prevGross)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Prev Ret'd:</span>
          <span className="font-medium">{formatCurrency(prevRetention)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Prev Pmts:</span>
          <span className="font-medium">{formatCurrency(prevPayments)}</span>
        </div>
        <div className="flex items-center justify-between text-sm pt-1.5 border-t">
          <span className="text-muted-foreground font-semibold">Contract Balance:</span>
          <span className="font-bold">{formatCurrency(contractBalance)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
