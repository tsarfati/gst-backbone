import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Receipt {
  id: string;
  filename: string;
  amount: string;
  date: string;
  vendor?: string;
  type: 'image' | 'pdf';
  previewUrl?: string;
  uploadedBy?: string;
  uploadedDate?: Date;
  assignedUser?: {
    id: string;
    name: string;
    role: string;
    assignedDate: Date;
  };
}

export interface ReceiptMessage {
  id: string;
  receiptId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'assignment' | 'coding' | 'status';
}

export interface CodedReceipt extends Receipt {
  job: string;
  costCode: string;
  codedBy: string;
  codedDate: Date;
}

interface ReceiptContextType {
  uncodedReceipts: Receipt[];
  codedReceipts: CodedReceipt[];
  messages: ReceiptMessage[];
  addReceipts: (files: FileList) => void;
  codeReceipt: (receiptId: string, job: string, costCode: string, codedBy: string) => void;
  assignReceipt: (receiptId: string, userId: string, userName: string, userRole: string) => void;
  unassignReceipt: (receiptId: string) => void;
  addMessage: (receiptId: string, message: string, userId: string, userName: string, type?: 'message' | 'assignment' | 'coding' | 'status') => void;
  deleteReceipt: (receiptId: string) => void;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function ReceiptProvider({ children }: { children: React.ReactNode }) {
  // Load receipts from localStorage or use demo data
  const [uncodedReceipts, setUncodedReceipts] = useState<Receipt[]>(() => {
    const saved = localStorage.getItem('uncoded-receipts');
    if (saved) {
      return JSON.parse(saved);
    }
    // Demo receipts only if no saved receipts exist
    return [
      {
        id: "demo-1",
        filename: "construction_materials_receipt.jpg",
        amount: "$1,245.89",
        date: "2024-01-18",
        vendor: "BuildMax Supply Co",
        type: 'image',
        previewUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=800&fit=crop",
        uploadedBy: "Controller",
        uploadedDate: new Date("2024-01-18T08:30:00Z"),
      },
      {
        id: "demo-2", 
        filename: "office_supplies_invoice.pdf",
        amount: "$156.42",
        date: "2024-01-17",
        vendor: "Office Depot",
        type: 'pdf',
        uploadedBy: "Admin",
        uploadedDate: new Date("2024-01-17T14:15:00Z"),
      },
      {
        id: "demo-3",
        filename: "fuel_receipt.jpg", 
        amount: "$89.76",
        date: "2024-01-16",
        vendor: "Shell Gas Station",
        type: 'image',
        previewUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&h=800&fit=crop",
        uploadedBy: "Field Manager",
        uploadedDate: new Date("2024-01-16T16:45:00Z"),
      },
    ];
  });
  const [codedReceipts, setCodedReceipts] = useState<CodedReceipt[]>([]);
  const [messages, setMessages] = useState<ReceiptMessage[]>([]);

  // Save receipts to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('uncoded-receipts', JSON.stringify(uncodedReceipts));
  }, [uncodedReceipts]);

  const addReceipts = useCallback((files: FileList) => {
    const newReceipts: Receipt[] = Array.from(files).map(file => {
      // Create a more persistent preview URL using FileReader for images
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      
      return {
        id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        amount: "$0.00",
        date: new Date().toISOString().split('T')[0],
        type: file.type.startsWith('image/') ? 'image' : 'pdf',
        previewUrl,
        uploadedBy: "Current User",
        uploadedDate: new Date(),
      };
    });

    setUncodedReceipts(prev => [...prev, ...newReceipts]);
  }, []);

  const codeReceipt = (receiptId: string, job: string, costCode: string, codedBy: string) => {
    const receipt = uncodedReceipts.find(r => r.id === receiptId);
    if (receipt) {
      const codedReceipt: CodedReceipt = {
        ...receipt,
        job,
        costCode,
        codedBy,
        codedDate: new Date(),
      };
      
      setCodedReceipts(prev => [...prev, codedReceipt]);
      setUncodedReceipts(prev => prev.filter(r => r.id !== receiptId));
      
      // Add coding message
      addMessage(receiptId, `Receipt coded to ${job} - ${costCode}`, "system", codedBy, 'coding');
    }
  };

  const assignReceipt = (receiptId: string, userId: string, userName: string, userRole: string) => {
    setUncodedReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? { 
            ...receipt, 
            assignedUser: { 
              id: userId, 
              name: userName, 
              role: userRole, 
              assignedDate: new Date() 
            } 
          }
        : receipt
    ));
    
    // Add assignment message
    addMessage(receiptId, `Receipt assigned to ${userName} for review`, "system", "System", 'assignment');
  };

  const unassignReceipt = (receiptId: string) => {
    const receipt = uncodedReceipts.find(r => r.id === receiptId);
    const assignedUserName = receipt?.assignedUser?.name || "user";
    
    setUncodedReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? { ...receipt, assignedUser: undefined }
        : receipt
    ));
    
    // Add unassignment message
    addMessage(receiptId, `Receipt unassigned from ${assignedUserName}`, "system", "System", 'status');
  };

  const addMessage = (receiptId: string, message: string, userId: string, userName: string, type: 'message' | 'assignment' | 'coding' | 'status' = 'message') => {
    const newMessage: ReceiptMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      receiptId,
      userId,
      userName,
      message,
      timestamp: new Date(),
      type
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  const deleteReceipt = (receiptId: string) => {
    setUncodedReceipts(prev => prev.filter(r => r.id !== receiptId));
    setCodedReceipts(prev => prev.filter(r => r.id !== receiptId));
    setMessages(prev => prev.filter(m => m.receiptId !== receiptId));
  };

  return (
    <ReceiptContext.Provider value={{ 
      uncodedReceipts, 
      codedReceipts, 
      messages,
      addReceipts, 
      codeReceipt,
      assignReceipt,
      unassignReceipt,
      addMessage,
      deleteReceipt
    }}>
      {children}
    </ReceiptContext.Provider>
  );
}

export function useReceipts() {
  const context = useContext(ReceiptContext);
  if (context === undefined) {
    throw new Error('useReceipts must be used within a ReceiptProvider');
  }
  return context;
}