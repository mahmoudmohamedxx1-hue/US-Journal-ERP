'use client'

import * as React from 'react'
import { create } from 'zustand'

export type ErpView =
  | 'dashboard'
  | 'accounts'
  | 'journals'
  | 'journal-new'
  | 'journal-detail'
  | 'reports'
  | 'vendors'
  | 'customers'
  | 'banking'
  | 'invoices'
  | 'bills'
  | 'inventory'
  | 'purchase-orders'
  | 'sales-orders'
  | 'recurring-journals'
  | 'budgets'
  | 'payments'
  | 'exchange-rates'
  | 'settings-users'
  | 'settings-org'
  | 'settings-periods'
  | 'journal-import'
  | 'fixed-assets'
  | 'timesheets'
  | 'period-close'
  | 'cash-flow-forecast'
  | 'reconciliation'
  | 'custom-report'
  | 'fx-revaluation'
  | 'consolidation'
  | 'payroll'
  | 'manufacturing'
  | 'ocr-scan'
  | 'audit-log'

interface AppState {
  view: ErpView
  selectedJournalId: string | null
  selectedReport: string
  /** A pending search query that the next-viewed screen can consume. */
  pendingSearch: string
  setView: (view: ErpView) => void
  openJournal: (id: string) => void
  setReport: (report: string) => void
  setPendingSearch: (q: string) => void
}

export const useErpStore = create<AppState>((set) => ({
  view: 'dashboard',
  selectedJournalId: null,
  selectedReport: 'trial-balance',
  pendingSearch: '',
  setView: (view) => set({ view }),
  openJournal: (id) => set({ view: 'journal-detail', selectedJournalId: id }),
  setReport: (report) => set({ selectedReport: report }),
  setPendingSearch: (q) => set({ pendingSearch: q }),
}))
