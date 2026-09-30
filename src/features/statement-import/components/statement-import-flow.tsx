"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n/client";
import type { ImportHeaderMapping } from "@/lib/import/csv";
import type { TransactionImportRowStatus } from "@/types/database";
import {
  confirmStatementImport,
  createStatementImport,
  prepareStatementImport,
  rollbackStatementImport,
  setImportDuplicateIncluded,
  type ImportPreview,
  type ImportPreviewRow,
} from "../actions";

interface AccountOption {
  id: string;
  name: string;
  institution: string | null;
  currencyCode: string;
}

type Step = "upload" | "mapping" | "preview" | "result";
type Filter = "all" | "ready" | "needs_review" | "duplicate" | "error";

const FIELD_LABELS: { key: keyof ImportHeaderMapping; required?: boolean }[] = [
  { key: "date", required: true },
  { key: "description", required: true },
  { key: "amount" },
  { key: "type" },
  { key: "debit" },
  { key: "credit" },
  { key: "reference" },
  { key: "currency" },
];

const STATUS_STYLE: Record<TransactionImportRowStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  ready: "default",
  needs_review: "secondary",
  duplicate: "outline",
  error: "destructive",
  imported: "default",
  skipped: "outline",
  rolled_back: "outline",
};

export function StatementImportFlow({
  accounts,
  initialPreview,
}: {
  accounts: AccountOption[];
  initialPreview: ImportPreview | null;
}) {
  const { locale } = useTranslation();
  const th = locale === "th";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(initialPreview?.batch.status === "confirmed" ? "result" : initialPreview ? "preview" : "upload");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [batchId, setBatchId] = useState(initialPreview?.batch.id ?? "");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<ImportHeaderMapping>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(initialPreview);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState(initialPreview?.batch.status === "confirmed" ? {
    importedCount: initialPreview.batch.imported_count,
    skippedCount: initialPreview.batch.skipped_count,
    reviewCount: initialPreview.batch.review_count,
    errorCount: initialPreview.batch.error_count,
  } : null);
  const [rolledBack, setRolledBack] = useState(initialPreview?.batch.status === "rolled_back");

  const copy = th ? {
    title: "นำเข้ารายการจาก CSV",
    subtitle: "ตรวจสอบก่อนบันทึกทุกครั้ง เงินจริงจะใช้ระบบรายการเดิมของ Wealth OS",
    chooseAccount: "นำเข้าไปยังบัญชี",
    chooseFile: "เลือกไฟล์รายการเดินบัญชี",
    fileHint: "CSV UTF-8 เท่านั้น สูงสุด 750 KB และ 2,000 แถว",
    analyze: "อ่านไฟล์ CSV",
    mapping: "จับคู่คอลัมน์",
    mappingHint: "ตรวจว่าคอลัมน์จากธนาคารตรงกับข้อมูลใดก่อนสร้างตัวอย่าง",
    none: "ไม่ใช้คอลัมน์นี้",
    continue: "สร้างตัวอย่าง",
    preview: "ตรวจสอบก่อนนำเข้า",
    confirm: "ยืนยันการนำเข้า",
    result: "นำเข้าเสร็จแล้ว",
    rollback: "ยกเลิกการนำเข้าครั้งนี้",
    rollbackConfirm: "ยืนยันยกเลิกเฉพาะรายการที่สร้างจาก batch นี้?",
    empty: "ไม่มีรายการในตัวกรองนี้",
    include: "นำเข้ารายการนี้",
    skip: "ข้ามเป็นรายการซ้ำ",
    imported: "นำเข้าแล้ว",
    review: "รอตรวจในกล่องรายการ",
    duplicate: "รายการซ้ำ",
    errors: "ผิดพลาด",
    ready: "พร้อม",
    all: "ทั้งหมด",
  } : {
    title: "Import transactions from CSV",
    subtitle: "Review before saving. Actual money continues through Wealth OS transactions.",
    chooseAccount: "Import into account",
    chooseFile: "Choose statement file",
    fileHint: "UTF-8 CSV only, up to 750 KB and 2,000 rows",
    analyze: "Read CSV",
    mapping: "Map columns",
    mappingHint: "Confirm how bank columns map before building the preview.",
    none: "Do not use",
    continue: "Build preview",
    preview: "Review before import",
    confirm: "Confirm import",
    result: "Import complete",
    rollback: "Undo this import",
    rollbackConfirm: "Undo only transactions created by this batch?",
    empty: "No rows in this filter",
    include: "Include this row",
    skip: "Skip as duplicate",
    imported: "Imported",
    review: "Needs review",
    duplicate: "Duplicates",
    errors: "Errors",
    ready: "Ready",
    all: "All",
  };

  const rows = useMemo(() => preview?.rows ?? [], [preview]);
  const counts = useMemo(() => rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>), [rows]);
  const visibleRows = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const canConfirm = Boolean(preview) && (counts.ready ?? 0) + (counts.needs_review ?? 0) > 0 && !pending;

  function submitFile(formData: FormData) {
    setError(null);
    formData.set("accountId", accountId);
    startTransition(async () => {
      const response = await createStatementImport(formData);
      if (!response.success) return setError(response.error);
      setBatchId(response.batchId);
      setHeaders(response.headers);
      setSampleRows(response.sampleRows);
      setMapping(response.detectedMapping);
      setStep("mapping");
      router.replace(`/money/import?batch=${response.batchId}`, { scroll: false });
    });
  }

  function buildPreview() {
    setError(null);
    startTransition(async () => {
      const response = await prepareStatementImport({ batchId, mapping });
      if (!response.success) return setError(response.error);
      setPreview(response);
      setStep("preview");
    });
  }

  function toggleDuplicate(row: ImportPreviewRow) {
    const include = row.status === "duplicate";
    startTransition(async () => {
      const response = await setImportDuplicateIncluded(row.id, include);
      if (!response.success) return setError(response.error);
      setPreview((current) => current ? {
        ...current,
        rows: current.rows.map((item) => item.id === row.id ? {
          ...item,
          status: include ? (item.normalized?.reviewRequired ? "needs_review" : "ready") : "duplicate",
        } : item),
      } : current);
    });
  }

  function confirmImport() {
    setError(null);
    startTransition(async () => {
      const response = await confirmStatementImport(batchId);
      if (!response.success) return setError(response.error);
      setResult(response);
      setStep("result");
      router.refresh();
    });
  }

  function rollback() {
    if (!window.confirm(copy.rollbackConfirm)) return;
    setError(null);
    startTransition(async () => {
      const response = await rollbackStatementImport(batchId);
      if (!response.success) return setError(response.error);
      setRolledBack(true);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="statement-import-flow">
      <Card variant="soft">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-primary-foreground"><FileSpreadsheet className="size-5" /></div>
            <div>
              <CardTitle className="text-lg">{copy.title}</CardTitle>
              <CardDescription>{copy.subtitle}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {step === "upload" && (
        <Card>
          <CardHeader><CardTitle>1. {copy.chooseFile}</CardTitle><CardDescription>{copy.fileHint}</CardDescription></CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="rounded-xl bg-muted p-4 text-sm">{th ? "เพิ่มบัญชีก่อนนำเข้า CSV" : "Add an account before importing CSV."}</div>
            ) : (
              <form action={submitFile} className="space-y-4">
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>{copy.chooseAccount}</span>
                  <select className="h-10 w-full rounded-lg border border-input bg-background px-3" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currencyCode}</option>)}
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>{copy.chooseFile}</span>
                  <Input name="file" type="file" accept=".csv,text/csv" required className="h-11 py-2" />
                </label>
                <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto"><Upload />{pending ? (th ? "กำลังอ่าน..." : "Reading...") : copy.analyze}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <Card>
          <CardHeader><CardTitle>2. {copy.mapping}</CardTitle><CardDescription>{copy.mappingHint}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELD_LABELS.map(({ key, required }) => (
                <label key={key} className="space-y-1 text-sm font-medium">
                  <span className="capitalize">{key}{required ? " *" : ""}</span>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-background px-3"
                    value={mapping[key] ?? ""}
                    onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value || null }))}
                  >
                    <option value="">{copy.none}</option>
                    {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-muted"><tr>{headers.map((header) => <th className="px-3 py-2 font-medium" key={header}>{header}</th>)}</tr></thead>
                <tbody>{sampleRows.map((row, index) => <tr key={index} className="border-t">{headers.map((header) => <td className="max-w-52 truncate px-3 py-2" key={header}>{row[header]}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <Button size="lg" disabled={pending} onClick={buildPreview} className="w-full sm:w-auto">{pending ? (th ? "กำลังเตรียม..." : "Preparing...") : copy.continue}</Button>
          </CardContent>
        </Card>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>3. {copy.preview}</CardTitle><CardDescription>{preview.batch.row_count} {th ? "แถว" : "rows"}</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Summary icon={CheckCircle2} label={copy.ready} value={counts.ready ?? 0} />
              <Summary icon={AlertCircle} label={copy.review} value={counts.needs_review ?? 0} />
              <Summary icon={SkipForward} label={copy.duplicate} value={counts.duplicate ?? 0} />
              <Summary icon={AlertCircle} label={copy.errors} value={counts.error ?? 0} />
            </CardContent>
          </Card>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["all", "ready", "needs_review", "duplicate", "error"] as Filter[]).map((value) => (
              <Button key={value} variant={filter === value ? "default" : "outline"} size="sm" onClick={() => setFilter(value)}>
                {value === "all" ? copy.all : value === "needs_review" ? copy.review : value === "duplicate" ? copy.duplicate : value === "error" ? copy.errors : copy.ready}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            {visibleRows.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{copy.empty}</div>}
            {visibleRows.map((row) => <PreviewRowCard key={row.id} row={row} locale={locale} pending={pending} onToggleDuplicate={() => toggleDuplicate(row)} />)}
          </div>
          <div className="sticky bottom-24 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:static sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <Button size="lg" className="w-full sm:w-auto" disabled={!canConfirm} onClick={confirmImport}><ShieldCheck />{pending ? (th ? "กำลังนำเข้า..." : "Importing...") : copy.confirm}</Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3"><CheckCircle2 className="size-7 text-primary" /><div><CardTitle className="text-lg">{rolledBack ? (th ? "ยกเลิกการนำเข้าแล้ว" : "Import rolled back") : copy.result}</CardTitle><CardDescription>{th ? "ยอดบัญชีและหน้าหลักคำนวณจาก transactions เดิม" : "Balances and dashboard use the existing transaction ledger."}</CardDescription></div></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Summary icon={CircleDollarSign} label={copy.imported} value={rolledBack ? 0 : result.importedCount} />
              <Summary icon={SkipForward} label={copy.duplicate} value={result.skippedCount} />
              <Summary icon={AlertCircle} label={copy.review} value={rolledBack ? 0 : result.reviewCount} />
              <Summary icon={AlertCircle} label={copy.errors} value={result.errorCount} />
            </div>
            {!rolledBack && <Button variant="destructive" disabled={pending} onClick={rollback}><RotateCcw />{copy.rollback}</Button>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: number }) {
  return <div className="rounded-xl bg-muted/60 p-3"><Icon className="mb-2 size-4 text-primary" /><div className="text-xl font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

function PreviewRowCard({ row, locale, pending, onToggleDuplicate }: { row: ImportPreviewRow; locale: string; pending: boolean; onToggleDuplicate: () => void }) {
  const normalized = row.normalized;
  const th = locale === "th";
  return (
    <Card size="sm" data-testid={`import-row-${row.status}`}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">#{row.rowNumber} {normalized?.merchant || normalized?.description || (th ? "อ่านข้อมูลไม่ได้" : "Unreadable row")}</span><Badge variant={STATUS_STYLE[row.status]}>{row.status}</Badge></div>
          {normalized ? <div className="text-xs text-muted-foreground">{normalized.date} · {normalized.type === "expense" ? "−" : "+"}{normalized.amount} {normalized.currencyCode} · {normalized.categorySource ?? "unknown"}</div> : <div className="text-xs text-destructive">{row.errorCode}</div>}
        </div>
        {normalized && ["duplicate", "ready", "needs_review"].includes(row.status) && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={onToggleDuplicate}>
            {row.status === "duplicate" ? (th ? "นำเข้า" : "Include") : (th ? "ข้าม" : "Skip")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
