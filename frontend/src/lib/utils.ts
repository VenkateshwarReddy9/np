import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return `${formatDate(date)} ${formatTime(date)}`
}

export function elapsedMinutes(from: string | Date): number {
  return Math.floor((Date.now() - new Date(from).getTime()) / 60000)
}

export function ticketColorClass(displayedAt: string): string {
  const mins = elapsedMinutes(displayedAt)
  if (mins < 5) return 'kds-ticket-fresh'
  if (mins < 10) return 'kds-ticket-warning'
  return 'kds-ticket-overdue'
}
