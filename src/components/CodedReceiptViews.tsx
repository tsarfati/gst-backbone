import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, Building, Code, Receipt as ReceiptIcon, User, FileImage, FileText, Eye, MessageSquare, Briefcase } from 'lucide-react';
import { CodedReceipt } from '@/contexts/ReceiptContext';

interface CodedReceiptViewsProps {
  receipts: CodedReceipt[];
  selectedReceipts: string[];
  onSelectReceipt: (id: string) => void;
  onReceiptClick: (receipt: CodedReceipt) => void;
  onUncodeReceipt?: (receipt: CodedReceipt) => void;
  currentView: 'list' | 'compact' | 'super-compact' | 'icons';
}

export function CodedReceiptListView({ receipts, selectedReceipts, onSelectReceipt, onReceiptClick, onUncodeReceipt }: Omit<CodedReceiptViewsProps, 'currentView'>) {
  return (
    <div className="space-y-4">
      {receipts.map((receipt) => (
        <Card key={receipt.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <Checkbox
                  checked={selectedReceipts.includes(receipt.id)}
                  onCheckedChange={() => onSelectReceipt(receipt.id)}
                  className="mt-1"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground mb-1">{receipt.filename}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {receipt.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {receipt.amount}
                        </span>
                        {receipt.vendor && (
                          <span className="flex items-center gap-1">
                            <Building className="h-4 w-4" />
                            {receipt.vendor}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => onReceiptClick(receipt)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {onUncodeReceipt && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onUncodeReceipt(receipt);
                          }}
                        >
                          Uncode
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-sm">Job:</span>
                        <Badge variant="secondary">{receipt.jobName || 'No job'}</Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-sm">Cost Code:</span>
                        <Badge variant="outline">{receipt.costCodeName || 'No cost code'}</Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-purple-500" />
                        <span className="font-medium text-sm">Uploaded by:</span>
                        <span className="text-sm text-muted-foreground">{receipt.uploadedBy}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CodedReceiptCompactView({ receipts, selectedReceipts, onSelectReceipt, onReceiptClick }: Omit<CodedReceiptViewsProps, 'currentView'>) {
  return (
    <div className="space-y-2">
      {receipts.map((receipt) => (
        <Card key={receipt.id} className="hover:bg-primary/10 hover:border-primary transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedReceipts.includes(receipt.id)}
                onCheckedChange={() => onSelectReceipt(receipt.id)}
              />
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                <div className="md:col-span-2">
                  <h4 className="font-medium text-sm truncate">{receipt.filename}</h4>
                  <p className="text-xs text-muted-foreground">{receipt.date}</p>
                </div>
                
                <div className="text-sm font-medium">{receipt.amount}</div>
                
                <div className="text-sm text-muted-foreground truncate">
                  {receipt.vendor || 'No vendor'}
                </div>
                
                <div className="space-y-1">
                  <Badge variant="secondary" className="text-xs">{receipt.jobName || 'No job'}</Badge>
                  <Badge variant="outline" className="text-xs">{receipt.costCodeName || 'No cost code'}</Badge>
                </div>
                
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => onReceiptClick(receipt)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CodedReceiptSuperCompactView({ receipts, selectedReceipts, onSelectReceipt, onReceiptClick }: Omit<CodedReceiptViewsProps, 'currentView'>) {
  return (
    <div className="space-y-1">
      {receipts.map((receipt) => (
        <div key={receipt.id} className="flex items-center gap-2 p-2 hover:bg-primary/10 hover:border-primary rounded border">
          <Checkbox
            checked={selectedReceipts.includes(receipt.id)}
            onCheckedChange={() => onSelectReceipt(receipt.id)}
            className="shrink-0"
          />
          
          <div className="flex-1 grid grid-cols-6 gap-2 items-center text-sm">
            <div className="truncate font-medium">{receipt.filename}</div>
            <div className="text-muted-foreground">{receipt.amount}</div>
            <div className="truncate text-muted-foreground">{receipt.vendor || '-'}</div>
            <div className="truncate">{receipt.jobName || 'No job'}</div>
            <div className="truncate">{receipt.costCodeName || 'No cost code'}</div>
            <div className="text-right">
              <Button size="sm" variant="ghost" onClick={() => onReceiptClick(receipt)} className="h-6 w-6 p-0">
                <Eye className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CodedReceiptIconView({ receipts, selectedReceipts, onSelectReceipt, onReceiptClick }: Omit<CodedReceiptViewsProps, 'currentView'>) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {receipts.map((receipt) => (
        <Card key={receipt.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onReceiptClick(receipt)}>
          <CardContent className="p-4 text-center">
            <div className="relative mb-3">
              <Checkbox
                checked={selectedReceipts.includes(receipt.id)}
                onCheckedChange={(checked) => {
                  onSelectReceipt(receipt.id);
                }}
                className="absolute top-0 right-0 z-10"
                onClick={(e) => e.stopPropagation()}
              />
              
              <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center bg-accent rounded-lg">
                {receipt.filename.toLowerCase().includes('.pdf') ? (
                  <FileText className="h-8 w-8 text-red-500" />
                ) : (
                  <FileImage className="h-8 w-8 text-blue-500" />
                )}
              </div>
            </div>
            
            <h4 className="font-medium text-sm truncate mb-1">{receipt.filename}</h4>
            <p className="text-xs text-muted-foreground mb-2">{receipt.amount}</p>
            
            <div className="space-y-1">
              <Badge variant="secondary" className="text-xs w-full truncate">
                {receipt.jobName || 'No job'}
              </Badge>
              <Badge variant="outline" className="text-xs w-full truncate">
                {receipt.costCodeName || 'No cost code'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}