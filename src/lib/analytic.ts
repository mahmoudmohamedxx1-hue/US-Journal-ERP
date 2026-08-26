/**
 * US Journal ERP — Analytic Accounting Engine
 *
 * Inspired by Odoo's analytic module.
 *
 * Odoo allows each journal line to be distributed across multiple analytic accounts
 * (projects, cost centers, departments) using a JSON distribution field:
 *   analytic_distribution = { "1": 60.0, "2": 40.0 }  // 60% to project A, 40% to project B
 *
 * This module provides the same capability — track costs by project/department.
 */

import { db } from '@/lib/db'

export interface AnalyticDistribution {
  [analyticAccountId: string]: number  // percentage (0-100)
}

export interface AnalyticLine {
  id: string
  journalLineId: string
  analyticAccountId: string  // maps to Department, Location, or Project
  analyticType: 'department' | 'location' | 'project'
  percentage: number
  amount: number  // computed: journalLine.debit * percentage / 100
}

/**
 * Compute the analytic distribution for a journal line.
 *
 * Given a journal line amount and a distribution (e.g., { "dept-1": 60, "dept-2": 40 }),
 * compute the amount for each analytic account.
 *
 * @param amount - total amount of the journal line (debit or credit, in cents)
 * @param distribution - { analyticAccountId: percentage }
 * @returns array of { analyticAccountId, percentage, amount }
 */
export function computeAnalyticDistribution(
  amount: number,
  distribution: AnalyticDistribution,
): Array<{ analyticAccountId: string; percentage: number; amount: number }> {
  const results: Array<{ analyticAccountId: string; percentage: number; amount: number }> = []
  let totalPercent = 0

  for (const [accountId, percentage] of Object.entries(distribution)) {
    if (percentage <= 0) continue
    totalPercent += percentage
    results.push({
      analyticAccountId: accountId,
      percentage,
      amount: Math.round(amount * percentage / 100),
    })
  }

  // Validate total is 100% (Odoo enforces this)
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`Analytic distribution must total 100%, but got ${totalPercent}%`)
  }

  return results
}

/**
 * Get all analytic accounts (departments, projects, locations) for an org.
 * In Odoo, these are unified under account.analytic.account.
 * In our system, we map them from Department, Project, and Location models.
 */
export async function getAnalyticAccounts(organizationId: string) {
  const [departments, projects, locations] = await Promise.all([
    db.department.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, code: true },
    }),
    db.project.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, code: true },
    }),
    db.location.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, code: true },
    }),
  ])

  return {
    departments: departments.map(d => ({ ...d, type: 'department' as const })),
    projects: projects.map(p => ({ ...p, type: 'project' as const })),
    locations: locations.map(l => ({ ...l, type: 'location' as const })),
    all: [
      ...departments.map(d => ({ ...d, type: 'department' as const })),
      ...projects.map(p => ({ ...p, type: 'project' as const })),
      ...locations.map(l => ({ ...l, type: 'location' as const })),
    ],
  }
}

/**
 * Get the analytic distribution for a journal line.
 * Returns the department, project, and location assignments.
 */
export async function getJournalLineAnalytic(journalLineId: string) {
  const line = await db.journalLine.findUnique({
    where: { id: journalLineId },
    select: {
      departmentId: true,
      projectId: true,
      locationId: true,
      debit: true,
      credit: true,
    },
  })
  if (!line) return null

  const amount = Math.max(line.debit, line.credit)
  const distribution: AnalyticDistribution = {}

  // Each assignment represents 100% of the line for that dimension
  // (Odoo's multi-dimension approach — each dimension is independent)
  if (line.departmentId) distribution[line.departmentId] = 100
  if (line.projectId) distribution[line.projectId] = 100
  if (line.locationId) distribution[line.locationId] = 100

  return {
    journalLineId,
    amount,
    departmentId: line.departmentId,
    projectId: line.projectId,
    locationId: line.locationId,
    distribution,
  }
}

/**
 * Report: Analytic distribution by department/project/location.
 * Shows total debit/credit grouped by analytic dimension.
 *
 * This is Odoo's "Analytic Journal" report.
 */
export async function getAnalyticReport(
  organizationId: string,
  from: Date,
  to: Date,
  dimension: 'department' | 'project' | 'location',
) {
  const lines = await db.journalLine.findMany({
    where: {
      journal: {
        organizationId,
        status: 'Posted',
        journalDate: { gte: from, lte: to },
      },
      [`${dimension}Id`]: { not: null },
    },
    include: {
      journal: { select: { journalNumber: true, journalDate: true } },
      department: dimension === 'department',
      project: dimension === 'project',
      location: dimension === 'location',
    },
  })

  const grouped: Record<string, {
    id: string
    name: string
    code: string | null
    totalDebit: number
    totalCredit: number
    netAmount: number
    lineCount: number
  }> = {}

  for (const line of lines) {
    const dimId = dimension === 'department' ? line.departmentId :
                  dimension === 'project' ? line.projectId :
                  line.locationId
    if (!dimId) continue

    const dimEntity = dimension === 'department' ? line.department :
                      dimension === 'project' ? line.project :
                      line.location

    if (!grouped[dimId]) {
      grouped[dimId] = {
        id: dimId,
        name: dimEntity?.name || 'Unknown',
        code: dimEntity?.code || null,
        totalDebit: 0,
        totalCredit: 0,
        netAmount: 0,
        lineCount: 0,
      }
    }

    grouped[dimId].totalDebit += line.debit
    grouped[dimId].totalCredit += line.credit
    grouped[dimId].netAmount += line.debit - line.credit
    grouped[dimId].lineCount++
  }

  return Object.values(grouped).sort((a, b) => b.netAmount - a.netAmount)
}
