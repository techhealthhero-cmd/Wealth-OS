"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileSpreadsheet,
  Info,
  Loader2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

import { isPdfFile } from "../pdf-file";

import { PdfImportError, type PdfImportErrorCode, type StatementBankId } from "@/lib/import/pdf/types";

const BANK_NAMES: Record<StatementBankId, { th: string; en: string }> = {
  kbank: { th: "กสิกรไทย (K PLUS)", en: "KBank (K PLUS)" },
  scb: { th: "ไทยพาณิชย์", en: "SCB" },
  bbl: { th: "กรุงเทพ", en: "Bangkok Bank" },
  ktb: { th: "กรุงไทย", en: "Krungthai" },
  krungsri: { th: "กรุงศรี", en: "Krungsri" },
  ttb: { th: "ทีทีบี", en: "ttb" },
  gsb: { th: "ออมสิน", en: "GSB" },
};

// Localized copy for parser/extractor error codes; the core's own messages are bilingual.
const PDF_ERROR_COPY: Record<PdfImportErrorCode, { th: string; en: string }> = {
  pdf_too_large: { th: "ไฟล์ PDF ต้องไม่เกิน 5 MB", en: "PDF must be 5 MB or smaller." },
  pdf_extraction_limit: { th: "PDF มีหน้าหรือข้อความมากเกินไป ลองแบ่งไฟล์ หรือใช้ไฟล์ CSV จากธนาคาร", en: "This PDF has too many pages or too much text. Split it, or use a CSV from your bank." },
  pdf_timeout: { th: "อ่าน PDF นานเกินไป ลองไฟล์ที่เล็กลง หรือใช้ไฟล์ CSV", en: "Reading the PDF took too long. Try a smaller file or a CSV." },
  invalid_pdf: { th: "เปิดไฟล์ PDF นี้ไม่ได้ ตรวจสอบไฟล์อีกครั้ง หรือใช้ไฟล์ CSV", en: "Couldn't open this PDF. Check the file, or use a CSV." },
  password_required: { th: "PDF นี้ล็อกด้วยรหัสผ่าน กรุณาใส่รหัสผ่านจากธนาคาร", en: "This PDF is password-protected. Enter the password from your bank." },
  password_incorrect: { th: "รหัสผ่านไม่ถูกต้อง ลองอีกครั้ง", en: "Incorrect password. Please try again." },
  no_text: { th: "ไม่พบข้อความใน PDF (อาจเป็นภาพสแกน) ลองใช้ไฟล์ CSV จากธนาคาร", en: "No readable text found (it may be a scan). Try a CSV from your bank." },
  unrecognized_layout: { th: "ยังอ่านรูปแบบรายการเดินบัญชีนี้ไม่ได้ ลองใช้ไฟล์ CSV จากธนาคาร", en: "We can't read this statement layout yet. Try a CSV from your bank." },
  too_many_rows: { th: "มีรายการเกิน 2,000 รายการ กรุณาเลือกช่วงวันที่ให้สั้นลง", en: "More than 2,000 rows. Choose a shorter date range." },
  csv_too_large: { th: "ข้อมูลที่แปลงแล้วใหญ่เกินไป กรุณาเลือกช่วงวันที่ให้สั้นลง", en: "The converted data is too large. Choose a shorter date range." },
};

interface PdfNotice {
  rows: number;
  skipped: number;
  bank: StatementBankId | null;
}

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
  const passwordInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const extraction = useRef<AbortController | null>(null);
  const [pdfNotice, setPdfNotice] = useState<PdfNotice | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [passwordFocusRequest, setPasswordFocusRequest] = useState(0);
  const fieldId = useId();
  useEffect(() => () => { extraction.current?.abort(); }, []);
  // The password field may only mount after a password error, so focus after render.
  useEffect(() => { if (passwordFocusRequest) passwordInput.current?.focus(); }, [passwordFocusRequest]);
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
    title: "นำเข้ารายการจาก CSV / PDF",
    subtitle: "ตรวจสอบก่อนบันทึกทุกครั้ง เงินจริงจะใช้ระบบรายการเดิมของ Wealth OS",
    chooseAccount: "นำเข้าไปยังบัญชี",
    chooseFile: "เลือกไฟล์รายการเดินบัญชี",
    uploadHint: "เลือกบัญชี แล้วเลือกไฟล์ CSV หรือ PDF ที่ดาวน์โหลดจากธนาคาร",
    fileHint: "CSV ไม่เกิน 750 KB หรือ PDF ไม่เกิน 5 MB · สูงสุด 2,000 รายการต่อครั้ง",
    password: "รหัสผ่าน PDF",
    passwordOptional: "ถ้ามี",
    passwordHint: "ใส่เฉพาะเมื่อไฟล์ PDF จากธนาคารล็อกด้วยรหัสผ่าน ถ้าเปิดได้เลยให้เว้นว่าง",
    privacy: "PDF และรหัสผ่านถูกอ่านในเครื่องคุณเท่านั้น",
    privacyDetail: "ระบบได้รับเฉพาะรายการที่แปลงแล้ว",
    supportedBanks: "ธนาคารที่รองรับ PDF",
    bestEffort: "อ่านอัตโนมัติ อาจไม่ครบทุกรายการ กรุณาตรวจทานก่อนบันทึก",
    noAccounts: "เพิ่มบัญชีก่อน แล้วค่อยนำเข้ารายการ",
    goToAccounts: "ไปที่บัญชี",
    readingPdf: "กำลังอ่าน PDF…",
    readingFile: "กำลังอ่านไฟล์…",
    wrongType: "กรุณาเลือกไฟล์ CSV หรือ PDF",
    unknownError: "อ่านไฟล์ไม่ได้ กรุณาลองอีกครั้ง",
    analyze: "อ่านไฟล์",
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
    title: "Import transactions from CSV / PDF",
    subtitle: "Review before saving. Actual money continues through Wealth OS transactions.",
    chooseAccount: "Import into account",
    chooseFile: "Choose statement file",
    uploadHint: "Pick an account, then a CSV or PDF downloaded from your bank.",
    fileHint: "CSV up to 750 KB or PDF up to 5 MB · up to 2,000 rows per import",
    password: "PDF password",
    passwordOptional: "if any",
    passwordHint: "Only if your bank's PDF is password-protected. Leave blank if it opens normally.",
    privacy: "Your PDF and password are read on this device only.",
    privacyDetail: "We only receive the converted rows.",
    supportedBanks: "Banks supported for PDF",
    bestEffort: "Read automatically and may miss some rows — please review before saving.",
    noAccounts: "Add an account first, then import transactions.",
    goToAccounts: "Go to accounts",
    readingPdf: "Reading PDF…",
    readingFile: "Reading file…",
    wrongType: "Choose a CSV or PDF file.",
    unknownError: "Couldn't read the file. Please try again.",
    analyze: "Read file",
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

  function submitFile(event: React.FormEvent<HTMLFormElement>) {
    // Prevent native form submission: PDF bytes and the unnamed password input
    // must never enter a server action's FormData (even before hydration).
    event.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setError(null);
    setPdfNotice(null);
    const targetAccount = accountId;
    startTransition(async () => {
      try {
        let upload = file;
        if (await isPdfFile(file)) {
          setIsPdf(true);
          const { extractPdfLines, PDF_IMPORT_MAX_BYTES } = await import("../pdf-extract");
          if (file.size > PDF_IMPORT_MAX_BYTES) throw new PdfImportError("pdf_too_large", "ไฟล์ PDF ต้องไม่เกิน 5 MB / PDF must be 5 MB or smaller.");
          const controller = new AbortController();
          extraction.current = controller;
          let secret = passwordInput.current?.value ?? "";
          if (passwordInput.current) passwordInput.current.value = "";
          const parsing = extractPdfLines(file, secret, controller.signal);
          secret = "";
          const lines = await parsing;
          const { parsePdfStatement } = await import("@/lib/import/pdf/parsers");
          const { statementRowsToCsv } = await import("@/lib/import/pdf/csv");
          const parsed = parsePdfStatement(lines, new Date().getFullYear());
          upload = new File([statementRowsToCsv(parsed.rows)], "statement.csv", { type: "text/csv" });
          setPdfNotice({
            rows: parsed.rows.length,
            skipped: parsed.skippedLines,
            bank: parsed.detectedBank ?? (parsed.parser === "generic" ? null : parsed.parser),
          });
        } else if (!/\.csv$/i.test(file.name)) {
          setError(copy.wrongType);
          return;
        }
        if (passwordInput.current) passwordInput.current.value = "";
        if (fileInput.current) fileInput.current.value = "";
        const payload = new FormData();
        payload.set("accountId", targetAccount);
        payload.set("file", upload);
        const response = await createStatementImport(payload);
        if (!response.success) return setError(response.error);
        setBatchId(response.batchId);
        setHeaders(response.headers);
        setSampleRows(response.sampleRows);
        setMapping(response.detectedMapping);
        setStep("mapping");
        router.replace(`/money/import?batch=${response.batchId}`, { scroll: false });
      } catch (error) {
        setError(error instanceof PdfImportError ? (PDF_ERROR_COPY[error.code]?.[th ? "th" : "en"] ?? error.message) : copy.unknownError);
        if (error instanceof PdfImportError && error.code.startsWith("password_")) {
          setPasswordNeeded(true);
          setPasswordFocusRequest((count) => count + 1);
        }
      } finally {
        if (passwordInput.current) passwordInput.current.value = "";
        extraction.current = null;
      }
    });
  }

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    if (passwordInput.current) passwordInput.current.value = "";
    setError(null);
    setPasswordNeeded(false);
    const file = event.target.files?.[0];
    if (!file) return setIsPdf(false);
    // Same content check as submit; only decides whether to reveal the password field.
    void isPdfFile(file).then((pdf) => {
      if (fileInput.current?.files?.[0] === file) setIsPdf(pdf);
    }, () => setIsPdf(false));
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

      {pdfNotice && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm dark:border-primary/30 dark:bg-primary/10">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium">
              {th
                ? `อ่านจาก PDF${pdfNotice.bank ? ` ${BANK_NAMES[pdfNotice.bank].th}` : ""} ได้ ${pdfNotice.rows.toLocaleString("th-TH")} รายการ`
                : `Read ${pdfNotice.rows.toLocaleString("en-US")} rows from ${pdfNotice.bank ? `${BANK_NAMES[pdfNotice.bank].en} ` : ""}PDF`}
            </p>
            {pdfNotice.skipped > 0 && (
              <p className="text-muted-foreground">
                {th
                  ? `ข้าม ${pdfNotice.skipped.toLocaleString("th-TH")} บรรทัดที่อ่านไม่ชัด`
                  : `Skipped ${pdfNotice.skipped.toLocaleString("en-US")} unclear lines`}
              </p>
            )}
            <p className="text-muted-foreground">{copy.bestEffort}</p>
          </div>
        </div>
      )}

      {error && (
        <div id={`${fieldId}-error`} role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/10">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="min-w-0">{error}</p>
        </div>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader><CardTitle>1. {copy.chooseFile}</CardTitle><CardDescription>{copy.uploadHint}</CardDescription></CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="space-y-3 rounded-xl bg-muted p-4 text-sm">
                <p>{copy.noAccounts}</p>
                <Link href="/money/accounts" className={buttonVariants({ variant: "outline", className: "h-11 w-full sm:w-auto" })}>{copy.goToAccounts}</Link>
              </div>
            ) : (
              <form onSubmit={submitFile} aria-busy={pending} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor={`${fieldId}-account`} className="block text-sm font-medium">{copy.chooseAccount}</label>
                  <select
                    id={`${fieldId}-account`}
                    className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
                    value={accountId}
                    disabled={pending}
                    onChange={(event) => setAccountId(event.target.value)}
                  >
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currencyCode}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${fieldId}-file`} className="block text-sm font-medium">{copy.chooseFile}</label>
                  <Input
                    id={`${fieldId}-file`}
                    ref={fileInput}
                    type="file"
                    accept=".csv,.pdf,text/csv,application/pdf"
                    disabled={pending}
                    onChange={selectFile}
                    required
                    aria-describedby={`${fieldId}-file-hint`}
                    className="h-11 py-2.5 file:mr-2"
                  />
                  <p id={`${fieldId}-file-hint`} className="text-xs text-muted-foreground">{copy.fileHint}</p>
                </div>
                {(isPdf || passwordNeeded) && (
                  <div className="space-y-1.5">
                    <label htmlFor={`${fieldId}-password`} className="block text-sm font-medium">
                      {copy.password}
                      {!passwordNeeded && <span className="font-normal text-muted-foreground"> ({copy.passwordOptional})</span>}
                    </label>
                    {/* Unnamed on purpose: the password must never enter FormData or React state. */}
                    <Input
                      id={`${fieldId}-password`}
                      ref={passwordInput}
                      type="password"
                      autoComplete="off"
                      disabled={pending}
                      aria-invalid={passwordNeeded && Boolean(error) ? true : undefined}
                      aria-describedby={`${fieldId}-password-hint${passwordNeeded && error ? ` ${fieldId}-error` : ""}`}
                      className="h-11"
                    />
                    <p id={`${fieldId}-password-hint`} className="text-xs text-muted-foreground">{copy.passwordHint}</p>
                  </div>
                )}
                <div className="space-y-1 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
                  <p className="flex items-start gap-2">
                    <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="font-medium">{copy.privacy}</span>{" "}
                      <span className="text-muted-foreground">{copy.privacyDetail}</span>
                    </span>
                  </p>
                  <details className="group pl-6">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                      {copy.supportedBanks}
                      <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="space-y-1 pb-1 text-xs text-muted-foreground">
                      <p>{Object.values(BANK_NAMES).map((bank) => (th ? bank.th : bank.en)).join(" · ")}</p>
                      <p>{copy.bestEffort}</p>
                    </div>
                  </details>
                </div>
                <Button type="submit" size="lg" disabled={pending} className="h-11 w-full sm:w-auto">
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                  {pending ? (isPdf ? copy.readingPdf : copy.readingFile) : copy.analyze}
                </Button>
                <p role="status" className="sr-only">{pending ? (isPdf ? copy.readingPdf : copy.readingFile) : ""}</p>
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
