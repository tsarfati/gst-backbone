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
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function ReceiptProvider({ children }: { children: React.ReactNode }) {
  const [uncodedReceipts, setUncodedReceipts] = useState<Receipt[]>([
    {
      id: "mock-1",
      filename: "receipt_001.jpg",
      amount: "$245.50",
      date: "2024-01-15",
      vendor: "Home Depot",
      type: 'image',
      previewUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=800&fit=crop",
      uploadedBy: "Controller",
      uploadedDate: new Date("2024-01-15T10:30:00Z"),
    },
    {
      id: "mock-2",
      filename: "receipt_002.pdf",
      amount: "$89.99",
      date: "2024-01-14",
      vendor: "Office Supply Co",
      type: 'pdf',
      previewUrl: "https://images.unsplash.com/photo-1554224154-22dec7ec8818?w=600&h=800&fit=crop",
      uploadedBy: "Controller",
      uploadedDate: new Date("2024-01-14T14:20:00Z"),
    },
    {
      id: "mock-3",
      filename: "receipt_003.jpg",
      amount: "$1,250.00",
      date: "2024-01-13",
      vendor: "ABC Materials",
      type: 'image',
      previewUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop",
      uploadedBy: "Controller",
      uploadedDate: new Date("2024-01-13T09:15:00Z"),
    },
  ]);
  const [codedReceipts, setCodedReceipts] = useState<CodedReceipt[]>([]);
  const [messages, setMessages] = useState<ReceiptMessage[]>([]);

  const addReceipts = useCallback((files: FileList) => {
    const newReceipts: Receipt[] = Array.from(files).map(file => ({
      id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filename: file.name,
      amount: "$0.00",
      date: new Date().toISOString().split('T')[0],
      type: file.type.startsWith('image/') ? 'image' : 'pdf',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      uploadedBy: "Current User",
      uploadedDate: new Date(),
    }));

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

  return (
    <ReceiptContext.Provider value={{ 
      uncodedReceipts, 
      codedReceipts, 
      messages,
      addReceipts, 
      codeReceipt,
      assignReceipt,
      unassignReceipt,
      addMessage
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