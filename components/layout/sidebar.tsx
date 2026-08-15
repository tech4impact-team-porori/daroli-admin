"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "대시보드" },
  { href: "/requests", label: "요청 현황" },
  { href: "/review", label: "일지 검토" },
  { href: "/recipients", label: "대상자 관리" },
  { href: "/managers", label: "매니저 관리" },
  { href: "/payments", label: "활동비 관리" },
  { href: "/settings", label: "설정" },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center gap-1.5 border-b border-gray-200 px-5">
        <span className="text-lg font-bold text-emerald-600">다로리</span>
        <span className="text-xs text-gray-400">관리자</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
