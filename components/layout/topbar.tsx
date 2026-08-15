import { Button } from "@/components/ui/button"

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <Button variant="outline" size="sm" className="text-gray-600">
        기간: 이번 달 ▾
      </Button>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-gray-600">
          개인정보 보호 모드
        </Button>
        <Button variant="ghost" size="sm" className="text-gray-600">
          계정
        </Button>
      </div>
    </header>
  )
}
