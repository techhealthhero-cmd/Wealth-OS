import { ChevronDown, Wallet } from "lucide-react";

export interface SlipReviewControlsProps {
  accounts: { id: string; name: string }[];
  accountId: string;
  disabled: boolean;
  onAccountChange: (id: string) => void;
  onLater: () => void;
  /** Present only after a save; renders the quiet undo action. */
  onUndo?: () => void;
}

const quietButton =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[rgba(32,77,61,0.1)] px-4 text-sm font-semibold whitespace-nowrap text-[#173b30] active:bg-[rgba(32,77,61,0.16)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8a5b]/40";

export function SlipReviewControls({ accounts, accountId, disabled, onAccountChange, onLater, onUndo }: SlipReviewControlsProps) {
  const selected = accounts.find(a => a.id === accountId);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="relative inline-flex min-h-11 max-w-full min-w-0 flex-1 basis-48 items-center gap-1.5 rounded-full border-[1.5px] border-border bg-white px-3.5 text-sm font-medium shadow-[0_4px_8px_-6px_rgba(60,45,20,0.35)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#2f8a5b]/40">
        <Wallet className="size-4 shrink-0 text-[#2f8a5b]" aria-hidden="true" />
        <span className="shrink-0 text-xs font-normal text-muted-foreground">บัญชี</span>
        <span className="min-w-0 truncate text-[#173b30]">{selected?.name ?? ""}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <select
          aria-label="บัญชีสำหรับชุดสลิป"
          className="absolute -inset-[1.5px] size-[calc(100%+3px)] cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-default"
          value={accountId}
          disabled={disabled}
          onChange={e => onAccountChange(e.target.value)}
        >
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <button type="button" className={quietButton} onClick={onLater}>ไว้ดูทีหลัง</button>
      {onUndo ? <button type="button" className={quietButton} disabled={disabled} onClick={onUndo}>เลิกทำชุดนี้</button> : null}
    </div>
  );
}
