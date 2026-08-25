/**
 * Internationalization (i18n) — Arabic + English support.
 * Stores the current language in localStorage and provides
 * translation functions.
 */

export type Language = 'en' | 'ar'

export const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    chartOfAccounts: 'Chart of Accounts',
    journalRegister: 'Journal Register',
    financialReports: 'Financial Reports',
    importFromExcel: 'Import from Excel',
    vendors: 'Vendors (AP)',
    customers: 'Customers (AR)',
    invoices: 'Invoices',
    bills: 'Bills',
    cashBanking: 'Cash & Banking',
    payments: 'Payments',
    inventory: 'Inventory',
    purchaseOrders: 'Purchase Orders',
    salesOrders: 'Sales Orders',
    recurringJournals: 'Recurring Journals',
    budgets: 'Budgets',
    exchangeRates: 'Exchange Rates',
    cashFlowForecast: 'Cash Flow Forecast',
    periodClose: 'Period Close',
    fixedAssets: 'Fixed Assets',
    timesheets: 'Timesheets',
    reconciliation: 'Bank Reconciliation',
    customReport: 'Custom Report Builder',
    usersRoles: 'Users & Roles',
    organization: 'Organization',
    fiscalPeriods: 'Fiscal Periods',
    auditLog: 'Audit Log',
    // Common
    welcome: 'Welcome back',
    newJournal: 'New Journal Entry',
    create: 'Create',
    cancel: 'Cancel',
    save: 'Save',
    export: 'Export',
    search: 'Search',
    loading: 'Loading…',
    noData: 'No data found',
    // Accounting
    cashBalance: 'Cash Balance',
    ytdRevenue: 'YTD Revenue',
    ytdExpenses: 'YTD Expenses',
    netIncome: 'Net Income',
    accountsReceivable: 'Accounts Receivable',
    accountsPayable: 'Accounts Payable',
    unpostedJournals: 'Unposted Journals',
  },
  ar: {
    dashboard: 'لوحة التحكم',
    chartOfAccounts: 'دليل الحسابات',
    journalRegister: 'سجل القيود',
    financialReports: 'التقارير المالية',
    importFromExcel: 'استيراد من Excel',
    vendors: 'الموردون (دائنون)',
    customers: 'العملاء (مدينون)',
    invoices: 'فواتير',
    bills: 'فواتير مورد',
    cashBanking: 'النقد والبنوك',
    payments: 'المدفوعات',
    inventory: 'المخزون',
    purchaseOrders: 'أوامر الشراء',
    salesOrders: 'أوامر البيع',
    recurringJournals: 'القيود المتكررة',
    budgets: 'الموازنات',
    exchangeRates: 'أسعار الصرف',
    cashFlowForecast: 'توقع التدفق النقدي',
    periodClose: 'إقفال الفترة',
    fixedAssets: 'الأصول الثابتة',
    timesheets: 'سجلات الوقت',
    reconciliation: 'مطابقة البنك',
    customReport: 'منشئ التقارير المخصصة',
    usersRoles: 'المستخدمون والأدوار',
    organization: 'المنشأة',
    fiscalPeriods: 'الفترات المالية',
    auditLog: 'سجل التدقيق',
    welcome: 'مرحباً بعودتك',
    newJournal: 'قيد جديد',
    create: 'إنشاء',
    cancel: 'إلغاء',
    save: 'حفظ',
    export: 'تصدير',
    search: 'بحث',
    loading: 'جاري التحميل…',
    noData: 'لا توجد بيانات',
    cashBalance: 'الرصيد النقدي',
    ytdRevenue: 'الإيرادات السنوية',
    ytdExpenses: 'المصروفات السنوية',
    netIncome: 'صافي الدخل',
    accountsReceivable: 'الذمم المدينة',
    accountsPayable: 'الذمم الدائنة',
    unpostedJournals: 'قيود غير مرحلة',
  },
} as const

export type TranslationKey = keyof typeof translations.en

/** Get the current language from localStorage (defaults to 'en') */
export function getLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  return (localStorage.getItem('usj-lang') as Language) || 'en'
}

/** Set the current language and reload to apply RTL/LTR */
export function setLanguage(lang: Language) {
  localStorage.setItem('usj-lang', lang)
  // Set document direction
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  // Reload to apply
  window.location.reload()
}

/** Translate a key to the current language */
export function t(key: TranslationKey): string {
  const lang = getLanguage()
  return translations[lang]?.[key] || translations.en[key] || key
}
