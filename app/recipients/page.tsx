"use client"

import { useEffect, useMemo, useState } from "react"
import type { Dispatch, ReactNode, SetStateAction } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { db } from "@/lib/data"
import { CHEONGDO_REGIONS, MANAGER_STATUS, RECIPIENT_TYPE, RECIPIENT_TYPE_META } from "@/lib/status"
import type {
  ManagerWithStats,
  Recipient,
  RecipientType,
  RecipientWithManager,
  Region,
} from "@/lib/types"

const ALL = "all"
const UNASSIGNED = "unassigned"

type FormState = {
  name: string
  type: RecipientType
  age: string
  region: Region | ""
  addressDetail: string
  phone: string
  careNeeds: string
  managerId: string
}

const EMPTY_FORM: FormState = {
  name: "",
  type: RECIPIENT_TYPE.ELDER,
  age: "",
  region: "",
  addressDetail: "",
  phone: "",
  careNeeds: "",
  managerId: UNASSIGNED,
}

export default function RecipientsPage() {
  const [keyword, setKeyword] = useState("")
  const [regionFilter, setRegionFilter] = useState<string>(ALL)
  const [managerFilter, setManagerFilter] = useState<string>(ALL)
  const [typeFilter, setTypeFilter] = useState<string>(ALL)
  const [unassignedOnly, setUnassignedOnly] = useState(false)

  const [recipients, setRecipients] = useState<RecipientWithManager[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allManagers, setAllManagers] = useState<ManagerWithStats[]>([])

  // 🟨 마스킹 기본 ON — 항목 단위 클릭으로만 해제, 전체 해제 버튼은 만들지 않는다
  const [revealedAddress, setRevealedAddress] = useState<Set<string>>(new Set())
  const [revealedCareNeeds, setRevealedCareNeeds] = useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [formTarget, setFormTarget] = useState<RecipientWithManager | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RecipientWithManager | null>(null)
  const [deleting, setDeleting] = useState(false)

  function fetchRecipients() {
    setError(null)
    setRecipients(null)
    db.listRecipients({
      keyword: keyword.trim() || undefined,
      region: regionFilter === ALL ? undefined : (regionFilter as Region),
      managerId: managerFilter === ALL ? undefined : managerFilter,
      type: typeFilter === ALL ? undefined : (typeFilter as RecipientType),
      unassignedOnly: unassignedOnly || undefined,
    })
      .then(setRecipients)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "대상자 목록을 불러오지 못했습니다"),
      )
  }

  useEffect(() => {
    db.listManagers({}).then(setAllManagers).catch(() => undefined)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 필터 변경 시 목록 재조회
    fetchRecipients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionFilter, managerFilter, typeFilter, unassignedOnly])

  const activeManagers = useMemo(
    () => allManagers.filter((m) => m.status === MANAGER_STATUS.ACTIVE),
    [allManagers],
  )

  const regionItems = useMemo(
    () => ({ [ALL]: "전체 지역", ...Object.fromEntries(CHEONGDO_REGIONS.map((r) => [r, r])) }),
    [],
  )
  const managerItems = useMemo(
    () => ({ [ALL]: "전체 매니저", ...Object.fromEntries(allManagers.map((m) => [m.id, m.name])) }),
    [allManagers],
  )
  const typeItems = {
    [ALL]: "전체 유형",
    [RECIPIENT_TYPE.ELDER]: RECIPIENT_TYPE_META[RECIPIENT_TYPE.ELDER].label,
    [RECIPIENT_TYPE.CHILD]: RECIPIENT_TYPE_META[RECIPIENT_TYPE.CHILD].label,
  }
  const formManagerItems = useMemo(
    () => ({
      [UNASSIGNED]: "미배정",
      ...Object.fromEntries(activeManagers.map((m) => [m.id, m.name])),
    }),
    [activeManagers],
  )
  const formRegionItems = useMemo(
    () => Object.fromEntries(CHEONGDO_REGIONS.map((r) => [r, r])),
    [],
  )
  const formTypeItems = {
    [RECIPIENT_TYPE.ELDER]: RECIPIENT_TYPE_META[RECIPIENT_TYPE.ELDER].label,
    [RECIPIENT_TYPE.CHILD]: RECIPIENT_TYPE_META[RECIPIENT_TYPE.CHILD].label,
  }

  function toggleReveal(set: Dispatch<SetStateAction<Set<string>>>, id: string) {
    set((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openCreate() {
    setFormMode("create")
    setFormTarget(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(r: RecipientWithManager) {
    setFormMode("edit")
    setFormTarget(r)
    setForm({
      name: r.name,
      type: r.type,
      age: r.age !== undefined ? String(r.age) : "",
      region: r.region,
      addressDetail: r.addressDetail,
      phone: r.phone ?? "",
      careNeeds: r.careNeeds ?? "",
      managerId: r.managerId ?? UNASSIGNED,
    })
    setFormError(null)
    setFormOpen(true)
  }

  async function handleFormSubmit() {
    if (!form.name.trim()) {
      setFormError("이름은 필수입니다")
      return
    }
    if (!form.region) {
      setFormError("지역을 선택하세요")
      return
    }
    setSaving(true)
    setFormError(null)

    const patch: Omit<Recipient, "id" | "createdAt"> = {
      name: form.name.trim(),
      type: form.type,
      age: form.type === RECIPIENT_TYPE.CHILD && form.age ? Number(form.age) : undefined,
      region: form.region,
      addressDetail: form.addressDetail.trim(),
      phone: form.phone.trim() || undefined,
      careNeeds: form.careNeeds.trim() || undefined,
      managerId: form.managerId === UNASSIGNED ? undefined : form.managerId,
    }

    try {
      if (formMode === "create") {
        await db.createRecipient(patch)
      } else if (formTarget) {
        await db.updateRecipient(formTarget.id, patch)
      }
      setFormOpen(false)
      fetchRecipients()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "저장하지 못했습니다")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await db.deleteRecipient(deleteTarget.id)
      setDeleteTarget(null)
      fetchRecipients()
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했습니다")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">대상자 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            담당 매니저 배정 정보가 지역별 매니저 부족 판정의 기준이 됩니다.
          </p>
        </div>
        <Button onClick={openCreate}>신규 등록</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchRecipients()}
          placeholder="이름 검색"
          className="max-w-56"
        />
        <Select items={regionItems} value={regionFilter} onValueChange={(v) => setRegionFilter(v as string)}>
          <SelectTrigger>
            <SelectValue placeholder="지역" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 지역</SelectItem>
            {CHEONGDO_REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={managerItems} value={managerFilter} onValueChange={(v) => setManagerFilter(v as string)}>
          <SelectTrigger>
            <SelectValue placeholder="매니저" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 매니저</SelectItem>
            {allManagers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={typeItems} value={typeFilter} onValueChange={(v) => setTypeFilter(v as string)}>
          <SelectTrigger>
            <SelectValue placeholder="유형" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(typeItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={unassignedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnassignedOnly((v) => !v)}
        >
          미배정만 보기
        </Button>
        <Button variant="outline" size="sm" onClick={fetchRecipients}>
          검색
        </Button>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-rose-700">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchRecipients}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && recipients === null && (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          불러오는 중...
        </div>
      )}

      {!error && recipients !== null && recipients.length === 0 && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-24 text-sm text-muted-foreground">
          표시할 대상자가 없습니다
        </div>
      )}

      {!error && recipients !== null && recipients.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>지역</TableHead>
                  <TableHead>담당 매니저</TableHead>
                  <TableHead>돌봄 필요사항</TableHead>
                  <TableHead>상세 주소</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r) => (
                  <TableRow key={r.id} className={r.deletedAt ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="font-medium">
                        {r.name}
                        {r.deletedAt && <span className="ml-1 text-xs text-muted-foreground">(삭제됨)</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {RECIPIENT_TYPE_META[r.type].label}
                        {r.type === RECIPIENT_TYPE.CHILD && r.age !== undefined ? `(${r.age}세)` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.region}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.manager ? (
                        <Badge variant="outline" className="text-xs">
                          {r.manager.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-xs text-rose-700">
                          미배정
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-40">
                      {!r.careNeeds ? (
                        <span className="text-muted-foreground">-</span>
                      ) : revealedCareNeeds.has(r.id) ? (
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => toggleReveal(setRevealedCareNeeds, r.id)}
                        >
                          {r.careNeeds}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-muted-foreground hover:underline"
                          onClick={() => toggleReveal(setRevealedCareNeeds, r.id)}
                        >
                          ●●●● 보기
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48">
                      {revealedAddress.has(r.id) ? (
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => toggleReveal(setRevealedAddress, r.id)}
                        >
                          {r.addressDetail}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-muted-foreground hover:underline"
                          onClick={() => toggleReveal(setRevealedAddress, r.id)}
                        >
                          {r.region} 상세보기
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                          수정
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeleteTarget(r)}>
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "대상자 신규 등록" : "대상자 정보 수정"}</DialogTitle>
            <DialogDescription>이름과 지역은 필수입니다.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <FormField label="이름">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>

            <FormField label="유형">
              <Select
                items={formTypeItems}
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as RecipientType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(formTypeItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {form.type === RECIPIENT_TYPE.CHILD && (
              <FormField label="나이">
                <Input
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                />
              </FormField>
            )}

            <FormField label="지역">
              <Select
                items={formRegionItems}
                value={form.region}
                onValueChange={(v) => setForm({ ...form, region: v as Region })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {CHEONGDO_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="상세 주소">
              <Input
                value={form.addressDetail}
                onChange={(e) => setForm({ ...form, addressDetail: e.target.value })}
              />
            </FormField>

            <FormField label="연락처">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>

            <FormField label="돌봄 필요사항">
              <Input
                value={form.careNeeds}
                onChange={(e) => setForm({ ...form, careNeeds: e.target.value })}
              />
            </FormField>

            <FormField label="담당 매니저">
              <Select
                items={formManagerItems}
                value={form.managerId}
                onValueChange={(v) => setForm({ ...form, managerId: v as string })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>미배정</SelectItem>
                  {activeManagers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {formError && <p className="text-sm text-rose-700">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              취소
            </Button>
            <Button disabled={saving} onClick={handleFormSubmit}>
              {formMode === "create" ? "등록" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="대상자를 삭제할까요?"
        description={deleteTarget ? `${deleteTarget.name}을(를) 목록에서 삭제합니다.` : ""}
        confirmLabel="삭제"
        destructive
        submitting={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}
