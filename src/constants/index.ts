import type { QuotationStatus, Role } from '../types';

export const QUOTATION_STATUSES: QuotationStatus[] = [
  'Draft',
  'Pending Approval',
  'Approved',
  'Rejected',
];

export const ROLES: Role[] = ['Employee', 'Manager', 'HR', 'Admin'];

export const DEFAULT_GST_PERCENT = 18;
