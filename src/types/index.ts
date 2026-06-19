export type Role = 'Employee' | 'Manager' | 'Admin';

// Complete status union matching backend model
export type QuotationStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Revision Requested'
  | 'Client Signed'
  | 'Paid';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  avatar?: string;
}

export interface ClientInfo {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  issueDate: string;
  expiryDate: string;
  status: QuotationStatus;
  clientInfo: ClientInfo;
  lineItems: LineItem[];
  subtotal: number;
  discountPercent: number;
  gstPercent: number;
  grandTotal: number;
  createdBy: User | string; // Can be nested User object or just ID string
  createdAt: string;
  updatedAt: string;
  remarks?: string;

  // Client portal fields
  client_access_token?: string;
  client_link_expires_at?: string;

  // Signature fields
  signed_by_name?: string;
  signed_by_email?: string;
  signed_at?: string;
  signature_data?: string;

  // Payment fields
  payment_status?: 'Unpaid' | 'Paid';
  paid_at?: string;
}

export interface NotificationEvent {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface QuotationTemplate {
  id: string;
  name: string;
  description: string;
  template_json: {
    lineItems?: {
      description: string;
      quantity: number;
      unitPrice: number;
    }[];
    discountPercent?: number;
    gstPercent?: number;
    notes?: string;
  };
  created_at: string;
}

export interface AIWarning {
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface AISuggestion {
  description: string;
  suggestedPrice: number;
  reason: string;
}

export interface PriceRecommendation {
  description: string;
  average: number;
  min: number;
  max: number;
  count: number;
}

export interface ManagerInsights {
  revenueLeakage: {
    totalLeakage: number;
    averageDiscount: number;
    trend: string;
  };
  followUps: {
    id: string;
    quotationNumber: string;
    client: string;
    daysStale: number;
    grandTotal: number;
    recommendation: string;
  }[];
  dealProbabilities: {
    id: string;
    quotationNumber: string;
    client: string;
    status: string;
    grandTotal: number;
    winProbability: number;
  }[];
}
