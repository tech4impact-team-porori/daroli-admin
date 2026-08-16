import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 오늘 기준 최근 n개월 'YYYY-MM' 목록 (오래된 → 최신 순, 이번 달 포함) */
export function lastNMonths(n: number): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return out
}
