'use client'

import * as React from 'react'
import { MoreVertical, Eye, Pencil, Trash2, FileText, Send, Printer } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface RowAction {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  destructive?: boolean
}

interface RowActionsProps {
  actions: RowAction[]
}

/**
 * Reusable row actions dropdown — appears on every list row.
 * Inspired by Odoo's list view action menu (the "gear" icon).
 *
 * Shows a "..." button that opens a dropdown with actions:
 *   - View details
 *   - Edit
 *   - Delete
 *   - Custom actions (post, send, print, etc.)
 */
export function RowActions({ actions }: RowActionsProps) {
  if (!actions || actions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && actions[idx - 1].destructive !== action.destructive && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={action.onClick}
              className={action.destructive ? 'text-destructive' : ''}
            >
              {action.icon && <action.icon className="mr-2 h-3.5 w-3.5" />}
              {action.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Pre-built action sets for common entities */
export function createViewAction(onClick: () => void): RowAction {
  return { label: 'View details', icon: Eye, onClick }
}

export function createEditAction(onClick: () => void): RowAction {
  return { label: 'Edit', icon: Pencil, onClick }
}

export function createDeleteAction(onClick: () => void): RowAction {
  return { label: 'Delete', icon: Trash2, onClick, destructive: true }
}

export function createPostAction(onClick: () => void): RowAction {
  return { label: 'Post to GL', icon: FileText, onClick }
}

export function createSendAction(onClick: () => void): RowAction {
  return { label: 'Send', icon: Send, onClick }
}

export function createPrintAction(onClick: () => void): RowAction {
  return { label: 'Print', icon: Printer, onClick }
}
