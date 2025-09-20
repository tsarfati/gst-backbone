import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Receipt {
  id: string;
  filename: string;
  amount: string;
  date: string;
  vendor?: string;
  type: 'image' | 'pdf';
  previewUrl: string;
  file: File;
  uploadedBy: string;
  uploadedDate: string;
  coded?: boolean;
  job?: string;
  costCode?: string;
  codedBy?: string;
  codedDate?: string;
}

interface ReceiptContextType {
  receipts: Receipt[];
  uncodedReceipts: Receipt[];
  addReceipts: (files: File[]) => void;
  codeReceipt: (receiptId: string, job: string, costCode: string, codedBy: string) => void;
  removeReceipt: (receiptId: string) => void;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export const useReceipts = () => {
  const context = useContext(ReceiptContext);
  if (!context) {
    throw new Error('useReceipts must be used within a ReceiptProvider');
  }
  return context;
};

// Initial mock data for demonstration
const initialReceipts: Receipt[] = [
  {
    id: "mock-1",
    filename: "receipt_001.jpg",
    amount: "$245.50",
    date: "2024-01-15",
    vendor: "Home Depot",
    type: 'image',
    previewUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=800&fit=crop",
    file: new File([], "receipt_001.jpg", { type: "image/jpeg" }),
    uploadedBy: "Controller",
    uploadedDate: "2024-01-15T10:30:00Z",
    coded: false,
  },
  {
    id: "mock-2",
    filename: "receipt_002.pdf",
    amount: "$89.99",
    date: "2024-01-14",
    vendor: "Office Supply Co",
    type: 'pdf',
    previewUrl: "https://images.unsplash.com/photo-1554224154-22dec7ec8818?w=600&h=800&fit=crop",
    file: new File([], "receipt_002.pdf", { type: "application/pdf" }),
    uploadedBy: "Controller",
    uploadedDate: "2024-01-14T14:20:00Z",
    coded: false,
  },
  {
    id: "mock-3",
    filename: "receipt_003.jpg",
    amount: "$1,250.00",
    date: "2024-01-13",
    vendor: "ABC Materials",
    type: 'image',
    previewUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop",
    file: new File([], "receipt_003.jpg", { type: "image/jpeg" }),
    uploadedBy: "Controller",
    uploadedDate: "2024-01-13T09:15:00Z",
    coded: false,
  },
];

export const ReceiptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);

  const generateReceiptId = () => {
    return `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const createPreviewUrl = (file: File): string => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    } else {
      // For PDFs, use a placeholder image
      return "https://images.unsplash.com/photo-1554224154-22dec7ec8818?w=600&h=800&fit=crop";
    }
  };

  const addReceipts = useCallback((files: File[]) => {
    const newReceipts: Receipt[] = files.map(file => ({
      id: generateReceiptId(),
      filename: file.name,
      amount: "$0.00", // Default amount - user can edit later
      date: new Date().toISOString().split('T')[0],
      type: file.type.startsWith('image/') ? 'image' : 'pdf',
      previewUrl: createPreviewUrl(file),
      file,
      uploadedBy: "Current User", // In real app, get from auth
      uploadedDate: new Date().toISOString(),
      coded: false,
    }));

    setReceipts(prev => [...prev, ...newReceipts]);
  }, []);

  const codeReceipt = useCallback((receiptId: string, job: string, costCode: string, codedBy: string) => {
    setReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? { 
            ...receipt, 
            coded: true, 
            job, 
            costCode, 
            codedBy, 
            codedDate: new Date().toISOString() 
          }
        : receipt
    ));
  }, []);

  const removeReceipt = useCallback((receiptId: string) => {
    setReceipts(prev => {
      const receipt = prev.find(r => r.id === receiptId);
      if (receipt && receipt.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(receipt.previewUrl);
      }
      return prev.filter(r => r.id !== receiptId);
    });
  }, []);

  const uncodedReceipts = receipts.filter(receipt => !receipt.coded);

  const value: ReceiptContextType = {
    receipts,
    uncodedReceipts,
    addReceipts,
    codeReceipt,
    removeReceipt,
  };

  return <ReceiptContext.Provider value={value}>{children}</ReceiptContext.Provider>;
};