"use client"

import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

/**
 * 반려 사유 필수 다이얼로그. 일지 반려·출금 반려 공용.
 * 🟦 기획서 규칙: 반려에는 사유가 필수 (일지·출금 모두)
 */
export function RejectDialog({
  open,
  onOpenChange,
  title,
  description,
  submitting = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  submitting?: boolean
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")

  function handleOpenChange(next: boolean) {
    if (!next) setReason("")
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="반려 사유를 입력하세요"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || submitting}
            onClick={() => {
              onConfirm(reason.trim())
              setReason("")
            }}
          >
            반려
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
