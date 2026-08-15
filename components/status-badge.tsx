import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StatusMeta, Tone } from '@/lib/status'

/**
 * 상태 색 규약 (기획서 2-0 공통 규약)
 * 대기·검토중=amber / 진행·확정=blue / 완료·승인=emerald / 반려·취소=rose
 */
const TONE_CLASS: Record<Tone, string> = {
  wait: 'border-amber-200 bg-amber-50 text-amber-700',
  progress: 'border-blue-200 bg-blue-50 text-blue-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  stop: 'border-rose-200 bg-rose-50 text-rose-700',
}

export function StatusBadge({ label, tone }: StatusMeta) {
  return (
    <Badge variant="outline" className={cn('font-medium', TONE_CLASS[tone])}>
      {label}
    </Badge>
  )
}
