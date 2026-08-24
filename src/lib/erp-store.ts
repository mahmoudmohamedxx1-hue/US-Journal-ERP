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
  | 'settings-users'
  | 'settings-org'
  | 'settings-periods'
  | 'audit-log'

interface AppState {
  view: ErpView
  selectedJournalId: string | null
  selectedReport: string
  setView: (view: ErpView) => void
  openJournal: (id: string) => void
  setReport: (report: string) => void
}

export const useErpStore = create<AppState>((set) => ({
  view: 'dashboard',
  selectedJournalId: null,
  selectedReport: 'trial-balance',
  setView: (view) => set({ view }),
  openJournal: (id) => set({ view: 'journal-detail', selectedJournalId: id }),
  setReport: (report) => set({ selectedReport: report }),
}))
