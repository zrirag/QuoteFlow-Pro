import { create } from 'zustand';
import type { 
  Quotation, 
  User, 
  NotificationEvent, 
  QuotationTemplate, 
  AIWarning, 
  AISuggestion, 
  PriceRecommendation, 
  ManagerInsights 
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import api from '../api';

interface AppState {
  currentUser: User | null;
  users: User[];
  quotations: Quotation[];
  notifications: NotificationEvent[];
  templates: QuotationTemplate[];
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
  
  fetchUsers: () => Promise<void>;
  addUser: (user: Partial<User>) => Promise<void>;
  updateUser: (id: string, user: Partial<User>) => Promise<void>;
  
  fetchQuotations: () => Promise<void>;
  addQuotation: (quotation: Partial<Quotation>) => Promise<Quotation | null>;
  updateQuotation: (id: string, quotation: Partial<Quotation>) => Promise<Quotation | null>;
  deleteQuotation: (id: string) => Promise<void>;
  
  approveQuotation: (id: string, remarks: string) => Promise<void>;
  rejectQuotation: (id: string, remarks: string) => Promise<void>;
  submitForApproval: (id: string) => Promise<void>;
  
  addNotification: (notification: Omit<NotificationEvent, 'id' | 'date' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;

  // Phase 4 additions
  downloadPdf: (id: string) => Promise<void>;
  exportExcel: () => Promise<void>;
  exportCsv: () => Promise<void>;
  getQuotationVersions: (id: string) => Promise<any[]>;
  rollbackQuotation: (id: string, versionNumber: number) => Promise<void>;
  getDriveStatus: () => Promise<any>;
  connectGoogleDrive: () => Promise<void>;
  disconnectDrive: () => Promise<void>;
  uploadToDrive: (id: string) => Promise<void>;
  
  // Phase 5 additions
  fetchPublicQuotation: (id: string, token: string) => Promise<Quotation | null>;
  signPublicQuotation: (id: string, token: string, name: string, email: string, signatureData: string) => Promise<Quotation | null>;
  fetchPublicComments: (id: string, token: string) => Promise<any[]>;
  postPublicComment: (id: string, token: string, name: string, content: string, isRevisionRequest: boolean) => Promise<any | null>;
  payPublicQuotation: (id: string, token: string) => Promise<any>;
  confirmPublicPayment: (id: string, token: string) => Promise<Quotation | null>;
  
  fetchInternalComments: (id: string) => Promise<any[]>;
  postInternalComment: (id: string, content: string) => Promise<any | null>;
  fetchViewLogs: (id: string) => Promise<any[]>;

  fetchTemplates: () => Promise<void>;
  analyzeQuotation: (payload: any) => Promise<AIWarning[]>;
  fetchItemSuggestions: (descriptions: string[]) => Promise<AISuggestion[]>;
  fetchPriceRecommendation: (desc: string) => Promise<PriceRecommendation | null>;
  fetchManagerInsights: () => Promise<ManagerInsights | null>;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  users: [],
  quotations: [],
  notifications: [],
  templates: [],

  login: async (email, password) => {
    try {
      const response = await api.post('token/', { username: email, password });
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      await get().fetchCurrentUser();
      return true;
    } catch (error) {
      console.error("Login failed", error);
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ currentUser: null, quotations: [], users: [] });
  },

  fetchCurrentUser: async () => {
    try {
      const response = await api.get('users/me/');
      // Map DRF User to our User type. Assuming DRF returns id, username, email, role, first_name, last_name
      const data = response.data;
      const user: User = {
        id: data.id,
        name: `${data.first_name} ${data.last_name}`.trim() || data.username,
        email: data.email || data.username,
        role: data.role,
        isActive: true
      };
      set({ currentUser: user });
    } catch (error) {
      console.error("Fetch current user failed", error);
      set({ currentUser: null });
    }
  },

  fetchUsers: async () => {
    try {
      const response = await api.get('users/');
      const users: User[] = response.data.map((u: any) => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`.trim() || u.username,
        email: u.email || u.username,
        role: u.role,
        isActive: true
      }));
      set({ users });
    } catch (error) {
      console.error("Fetch users failed", error);
    }
  },

  addUser: async (user) => {
    // Implement API call if admin role
    await get().fetchUsers();
  },

  updateUser: async (id, user) => {
    // Implement API call if admin role
    await get().fetchUsers();
  },

  fetchQuotations: async () => {
    try {
      const response = await api.get('quotations/');
      set({ quotations: response.data });
    } catch (error) {
      console.error("Fetch quotations failed", error);
    }
  },

  addQuotation: async (quotation) => {
    try {
      const response = await api.post('quotations/', quotation);
      set((state) => ({ quotations: [response.data, ...state.quotations] }));
      return response.data;
    } catch (error) {
      console.error("Add quotation failed", error);
      return null;
    }
  },

  updateQuotation: async (id, quotation) => {
    try {
      const response = await api.patch(`quotations/${id}/`, quotation);
      set((state) => ({
        quotations: state.quotations.map((q) => q.id === id ? response.data : q)
      }));
      return response.data;
    } catch (error) {
      console.error("Update quotation failed", error);
      return null;
    }
  },

  deleteQuotation: async (id) => {
    try {
      await api.delete(`quotations/${id}/`);
      set((state) => ({
        quotations: state.quotations.filter((q) => q.id !== id)
      }));
    } catch (error) {
      console.error("Delete quotation failed", error);
    }
  },

  approveQuotation: async (id, remarks) => {
    try {
      const response = await api.post(`quotations/${id}/approve/`, { remarks });
      set((state) => ({
        quotations: state.quotations.map((q) => q.id === id ? response.data : q)
      }));
    } catch (error) {
      console.error("Approve quotation failed", error);
    }
  },

  rejectQuotation: async (id, remarks) => {
    try {
      const response = await api.post(`quotations/${id}/reject/`, { remarks });
      set((state) => ({
        quotations: state.quotations.map((q) => q.id === id ? response.data : q)
      }));
    } catch (error) {
      console.error("Reject quotation failed", error);
    }
  },

  submitForApproval: async (id) => {
    try {
      const response = await api.post(`quotations/${id}/submit_approval/`);
      set((state) => ({
        quotations: state.quotations.map((q) => q.id === id ? response.data : q)
      }));
    } catch (error) {
      console.error("Submit approval failed", error);
    }
  },

  addNotification: (notification) => set((state) => ({
    notifications: [{
      ...notification,
      id: uuidv4(),
      date: new Date().toISOString(),
      read: false,
    }, ...state.notifications]
  })),
  
  markNotificationAsRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) => n.id === id ? { ...n, read: true } : n)
  })),
  
  clearNotifications: () => set({ notifications: [] }),

  // Phase 4 additions
  downloadPdf: async (id: string) => {
    try {
      const response = await api.get(`quotations/${id}/pdf/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Quotation_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      // Revoke blob URL to prevent memory leak
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Download PDF failed", error);
      get().addNotification({ title: 'Export Failed', message: 'Failed to generate PDF.', type: 'error' });
    }
  },

  exportExcel: async () => {
    try {
      const response = await api.get('quotations/export/excel/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Quotations_Export.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      // Revoke blob URL to prevent memory leak
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Export Excel failed", error);
      get().addNotification({ title: 'Export Failed', message: 'Failed to generate Excel file.', type: 'error' });
    }
  },

  exportCsv: async () => {
    try {
      const response = await api.get('quotations/export/csv/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Quotations_Export.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      // Revoke blob URL to prevent memory leak
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Export CSV failed", error);
      get().addNotification({ title: 'Export Failed', message: 'Failed to generate CSV file.', type: 'error' });
    }
  },

  getQuotationVersions: async (id: string) => {
    try {
      const response = await api.get(`quotations/${id}/versions/`);
      return response.data;
    } catch (error) {
      console.error("Fetch versions failed", error);
      return [];
    }
  },

  rollbackQuotation: async (id: string, versionNumber: number) => {
    try {
      const response = await api.post(`quotations/${id}/versions/${versionNumber}/rollback/`);
      set((state) => ({
        quotations: state.quotations.map((q) => q.id === id ? response.data : q)
      }));
      get().addNotification({ title: 'Rollback Successful', message: `Restored to version ${versionNumber}`, type: 'success' });
    } catch (error) {
      console.error("Rollback failed", error);
      get().addNotification({ title: 'Rollback Failed', message: 'Failed to restore version.', type: 'error' });
    }
  },

  getDriveStatus: async () => {
    try {
      const response = await api.get('drive/status/');
      return response.data;
    } catch (error) {
      return { connected: false };
    }
  },

  connectGoogleDrive: async () => {
    try {
      const response = await api.get('drive/auth/');
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error("Connect Drive failed", error);
      get().addNotification({ title: 'Drive Error', message: 'Failed to initiate Google Drive connection.', type: 'error' });
    }
  },

  disconnectDrive: async () => {
    try {
      await api.post('drive/disconnect/');
      get().addNotification({ title: 'Drive Disconnected', message: 'Successfully disconnected from Google Drive.', type: 'success' });
    } catch (error) {
      console.error("Disconnect Drive failed", error);
    }
  },

  uploadToDrive: async (id: string) => {
    try {
      get().addNotification({ title: 'Uploading...', message: 'Uploading quotation to Google Drive.', type: 'info' });
      await api.post(`quotations/${id}/drive/upload/`);
      get().addNotification({ title: 'Upload Successful', message: 'Successfully uploaded to Google Drive.', type: 'success' });
    } catch (error: any) {
      console.error("Upload Drive failed", error);
      const detail = error.response?.data?.detail || 'Failed to upload to Google Drive.';
      get().addNotification({ title: 'Upload Failed', message: detail, type: 'error' });
    }
  },

  fetchPublicQuotation: async (id: string, token: string) => {
    try {
      const response = await api.get(`public/quotations/${id}/?token=${token}`);
      return response.data;
    } catch (error) {
      console.error("Fetch public quotation failed", error);
      throw error;
    }
  },

  signPublicQuotation: async (id: string, token: string, name: string, email: string, signatureData: string) => {
    try {
      const response = await api.post(`public/quotations/${id}/sign/?token=${token}`, { name, email, signature_data: signatureData });
      return response.data;
    } catch (error) {
      console.error("Sign public quotation failed", error);
      throw error;
    }
  },

  fetchPublicComments: async (id: string, token: string) => {
    try {
      const response = await api.get(`public/quotations/${id}/comments/?token=${token}`);
      return response.data;
    } catch (error) {
      console.error("Fetch public comments failed", error);
      return [];
    }
  },

  postPublicComment: async (id: string, token: string, name: string, content: string, isRevisionRequest: boolean) => {
    try {
      const response = await api.post(`public/quotations/${id}/comments/?token=${token}`, { name, content, is_revision_request: isRevisionRequest });
      return response.data;
    } catch (error) {
      console.error("Post public comment failed", error);
      return null;
    }
  },

  payPublicQuotation: async (id: string, token: string) => {
    try {
      const response = await api.post(`public/quotations/${id}/pay/?token=${token}`);
      return response.data;
    } catch (error) {
      console.error("Pay public quotation failed", error);
      throw error;
    }
  },

  confirmPublicPayment: async (id: string, token: string) => {
    try {
      const response = await api.post(`public/quotations/${id}/pay-confirm/?token=${token}`);
      return response.data;
    } catch (error) {
      console.error("Confirm public payment failed", error);
      throw error;
    }
  },

  fetchInternalComments: async (id: string) => {
    try {
      const response = await api.get(`quotations/${id}/comments/`);
      return response.data;
    } catch (error) {
      console.error("Fetch internal comments failed", error);
      return [];
    }
  },

  postInternalComment: async (id: string, content: string) => {
    try {
      const response = await api.post(`quotations/${id}/comments/`, { content });
      return response.data;
    } catch (error) {
      console.error("Post internal comment failed", error);
      return null;
    }
  },

  fetchViewLogs: async (id: string) => {
    try {
      const response = await api.get(`quotations/${id}/views/`);
      return response.data;
    } catch (error) {
      console.error("Fetch view logs failed", error);
      return [];
    }
  },

  fetchTemplates: async () => {
    try {
      const response = await api.get('templates/');
      set({ templates: response.data });
    } catch (error) {
      console.error("Fetch templates failed", error);
    }
  },

  analyzeQuotation: async (payload) => {
    try {
      const response = await api.post('ai/analyze/', payload);
      return response.data;
    } catch (error) {
      console.error("Analyze quotation failed", error);
      return [];
    }
  },

  fetchItemSuggestions: async (descriptions) => {
    try {
      const response = await api.post('ai/suggest-items/', { descriptions });
      return response.data;
    } catch (error) {
      console.error("Fetch item suggestions failed", error);
      return [];
    }
  },

  fetchPriceRecommendation: async (desc) => {
    try {
      const response = await api.get(`ai/price-recommendation/?description=${encodeURIComponent(desc)}`);
      return response.data;
    } catch (error) {
      console.error("Fetch price recommendation failed", error);
      return null;
    }
  },

  fetchManagerInsights: async () => {
    try {
      const response = await api.get('ai/insights/');
      return response.data;
    } catch (error) {
      console.error("Fetch manager insights failed", error);
      return null;
    }
  }

}));
