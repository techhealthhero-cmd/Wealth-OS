"use client";
import { useCaptureDisplay } from "../use-capture-display";
export function CaptureLargeTextToggle({ enabled, disabled, onChange }: { enabled: boolean; disabled?: boolean; onChange: (enabled: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={enabled} aria-label="ตัวใหญ่ อ่านง่าย" data-testid="capture-large-text-toggle" disabled={disabled} onClick={() => onChange(!enabled)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left text-base disabled:opacity-50"><span>ตัวใหญ่ อ่านง่าย</span><span aria-hidden="true">{enabled ? "เปิด" : "ปิด"}</span></button>;
}
export function CaptureDisplaySettings() {
  const display = useCaptureDisplay();
  return <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">หน้าจดรายการ</h2><CaptureLargeTextToggle enabled={display.largeText} disabled={!display.ready} onChange={display.setLargeText} /><p className="text-sm text-muted-foreground">ใช้เฉพาะหน้าจด บนอุปกรณ์นี้</p></section>;
}
export function CaptureTextSuggestion({ onTry, onDismiss, amount, direction = "จ่ายไป" }: {
  onTry: () => void; onDismiss: () => void; amount?: string; direction?: string;
}) {
  return (
    <aside data-testid="capture-suggestion-card" aria-label="ตัวหนังสือเล็กไปไหม?" className="min-h-0 space-y-3 overflow-y-auto rounded-2xl border border-primary/20 bg-background p-4">
      <div><p className="text-lg font-semibold">ตัวหนังสือเล็กไปไหม?</p>
        <p className="mt-1 text-sm text-muted-foreground">ลองโหมดตัวใหญ่ อ่านง่าย — ตัวใหญ่ขึ้น ปุ่มใหญ่ขึ้น เหลือแค่สิ่งที่ต้องดู</p>
      </div>
      {amount && <div className="grid grid-cols-2 gap-2" aria-label="ตัวอย่างขนาดตัวอักษร">
        <div className="min-w-0 rounded-xl border p-2"><span className="block text-xs text-muted-foreground">ตอนนี้</span><span className="block truncate text-sm font-semibold">{amount}</span></div>
        <div className="min-w-0 rounded-xl border border-primary/30 bg-primary/5 p-2"><span className="block text-xs text-muted-foreground">ตัวใหญ่ อ่านง่าย</span><span className="block truncate text-2xl font-bold">{amount}</span><span className="text-base font-semibold">{direction}</span></div>
      </div>}
      <div className="flex gap-2"><button type="button" onClick={onTry} className="min-h-11 flex-1 rounded-xl bg-primary px-3 font-semibold text-primary-foreground">ลองเลย</button><button type="button" onClick={onDismiss} className="min-h-11 flex-1 rounded-xl border px-3">ไว้ก่อน</button></div>
    </aside>
  );
}
