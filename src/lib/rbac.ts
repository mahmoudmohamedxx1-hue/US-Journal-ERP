/**
 * Role-Based Access Control (RBAC) for US Journal ERP.
 *
 * Two roles:
 *   Manager  — full access to everything (create, edit, post, close periods, import, settings)
 *   Employee — limited access (view-only + create draft journals, cannot post/close/manage users)
 *
 * The role is stored on the User table and enforced both client-side (UI)
 * and server-side (API via getSystemContext().userRole).
 *
 * Currently the auto-created admin user is "Administrator" (full access).
 * The admin can change any user's role via the Users screen.
 */

export type Role = 'Administrator' | 'Manager' | 'Employee'

export interface Permission {
  // Journal
  canCreateJournal: boolean
  canSubmitJournal: boolean
  canApproveJournal: boolean
  canPostJournal: boolean
  canReverseJournal: boolean
  // Period
  canClosePeriod: boolean
  canReopenPeriod: boolean
  canCreateFiscalYear: boolean
  // Data management
  canCreateVendor: boolean
  canCreateCustomer: boolean
  canCreateAccount: boolean
  canCreateBankAccount: boolean
  canCreateProduct: boolean
  canCreateInvoice: boolean
  canCreateBill: boolean
  canCreatePurchaseOrder: boolean
  canCreateSalesOrder: boolean
  canCreateBudget: boolean
  canCreateRecurringJournal: boolean
  // Import/Export
  canImportExcel: boolean
  canExportData: boolean
  // Admin
  canManageUsers: boolean
  canManageOrganization: boolean
  canViewAuditLog: boolean
  canResetDatabase: boolean
}

export const PERMISSIONS: Record<Role, Permission> = {
  Administrator: {
    canCreateJournal: true, canSubmitJournal: true, canApproveJournal: true,
    canPostJournal: true, canReverseJournal: true,
    canClosePeriod: true, canReopenPeriod: true, canCreateFiscalYear: true,
    canCreateVendor: true, canCreateCustomer: true, canCreateAccount: true,
    canCreateBankAccount: true, canCreateProduct: true, canCreateInvoice: true,
    canCreateBill: true, canCreatePurchaseOrder: true, canCreateSalesOrder: true,
    canCreateBudget: true, canCreateRecurringJournal: true,
    canImportExcel: true, canExportData: true,
    canManageUsers: true, canManageOrganization: true, canViewAuditLog: true,
    canResetDatabase: true,
  },
  Manager: {
    canCreateJournal: true, canSubmitJournal: true, canApproveJournal: true,
    canPostJournal: true, canReverseJournal: true,
    canClosePeriod: true, canReopenPeriod: true, canCreateFiscalYear: true,
    canCreateVendor: true, canCreateCustomer: true, canCreateAccount: true,
    canCreateBankAccount: true, canCreateProduct: true, canCreateInvoice: true,
    canCreateBill: true, canCreatePurchaseOrder: true, canCreateSalesOrder: true,
    canCreateBudget: true, canCreateRecurringJournal: true,
    canImportExcel: true, canExportData: true,
    canManageUsers: true, canManageOrganization: true, canViewAuditLog: true,
    canResetDatabase: false,
  },
  Employee: {
    canCreateJournal: true, canSubmitJournal: true, canApproveJournal: false,
    canPostJournal: false, canReverseJournal: false,
    canClosePeriod: false, canReopenPeriod: false, canCreateFiscalYear: false,
    canCreateVendor: true, canCreateCustomer: true, canCreateAccount: false,
    canCreateBankAccount: false, canCreateProduct: true, canCreateInvoice: true,
    canCreateBill: true, canCreatePurchaseOrder: true, canCreateSalesOrder: true,
    canCreateBudget: false, canCreateRecurringJournal: false,
    canImportExcel: false, canExportData: true,
    canManageUsers: false, canManageOrganization: false, canViewAuditLog: false,
    canResetDatabase: false,
  },
}

export function getPermissions(role: string): Permission {
  return PERMISSIONS[role as Role] || PERMISSIONS.Employee
}

export function canDo(role: string, permission: keyof Permission): boolean {
  return getPermissions(role)[permission]
}
