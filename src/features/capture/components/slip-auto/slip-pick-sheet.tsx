"use client";

import { Camera, Check, Images, Lightbulb, Lock, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";
import { slipCopy } from "./copy";
import { SlipGlyph } from "./slip-glyph";

export interface SlipPickSheetProps {
  open?: boolean;
  /** Multi-select result. Feeds processSlipBatch(files, deps) in SlipAutoFlow. */
  onPick: (files: File[]) => void;
  /** Single camera shot. Same pipeline with a one-file batch. */
  onTakePhoto: (file: File) => void;
  onClose?: () => void;
}

const FAN = [
  { rotate: -24, x: 95, y: 22, tint: "#5b3a8e" },
  { rotate: -12, x: 108, y: 14, tint: "#1e6fb8" },
  { rotate: 22, x: 152, y: 22, tint: "#e3a21f" },
  { rotate: 10, x: 140, y: 12, tint: "#e8742a" },
  { rotate: 0, x: 130, y: 8, tint: "#2f9e5b" },
] as const;

/** Step 1 — bottom sheet: one big green "choose from photos" action. */
export function SlipPickSheet({ open = true, onPick, onTakePhoto, onClose }: SlipPickSheetProps) {
  if (!open) return null;
  const c = slipCopy.pick;
  return (
    <div className="fixed inset-0 z-50" data-testid="slip-pick-sheet">
      <button
        type="button"
        aria-label={c.close}
        onClick={onClose}
        className="absolute inset-0 bg-[#26332d]/40"
      />
      <div
        role="dialog"
        aria-label={c.title}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-[28px] bg-[#fffbf2] px-5 pt-2.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-16px_30px_-10px_rgba(60,45,20,0.35)]"
      >
        <div className="mx-auto mb-3 h-[5px] w-11 rounded-full bg-[#d8cdb2]" />
        <h2 className="text-center text-[22px] leading-[30px] font-bold">{c.title}</h2>
        <p className="text-center text-[13.5px] leading-5 text-muted-foreground">{c.sub}</p>

        <svg viewBox="0 0 350 168" className="mx-auto mt-1.5 h-auto w-full max-w-[350px]" aria-hidden="true">
          <ellipse cx="175" cy="156" rx="120" ry="7" fill="rgba(60,45,20,.12)" />
          <g style={{ filter: "drop-shadow(0 4px 5px rgba(60,45,20,.22))" }}>
            {FAN.map((s) => (
              <g key={s.tint} transform={`rotate(${s.rotate} 175 150)`}>
                <SlipGlyph x={s.x} y={s.y} width={90} height={114} tint={s.tint} />
              </g>
            ))}
          </g>
        </svg>

        <label
          className={cn(
            "mt-1.5 flex h-[60px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#204d3d] text-lg font-bold text-white shadow-[0_8px_14px_-6px_rgba(23,59,48,0.55)]",
            "focus-within:ring-2 focus-within:ring-[#204d3d] focus-within:ring-offset-2"
          )}
        >
          <Images className="size-6" aria-hidden="true" />
          <span>{c.choose}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            data-testid="slip-pick-input"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length > 0) onPick(files);
            }}
          />
        </label>

        <label className="mt-2.5 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-[#c9b88f] bg-[#fffbf2]/70 text-[15.5px] font-semibold text-[#204d3d] focus-within:ring-2 focus-within:ring-[#204d3d] focus-within:ring-offset-2">
          <Camera className="size-5" aria-hidden="true" />
          <span>{c.takePhoto}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onTakePhoto(file);
            }}
          />
        </label>

        <ul className="mt-3.5 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[12.5px] font-medium text-[#204d3d]">
          <li className="inline-flex min-h-6 items-center gap-1.5">
            <Smartphone className="size-4" aria-hidden="true" />
            {c.local}
          </li>
          <li className="inline-flex min-h-6 items-center gap-1.5">
            <Lock className="size-4" aria-hidden="true" />
            {c.noStore}
          </li>
          <li className="inline-flex min-h-6 items-center gap-1.5">
            <Check className="size-4" aria-hidden="true" />
            {c.noTyping}
          </li>
        </ul>
        <p className="mt-3 flex items-center justify-center gap-2 rounded-[14px] bg-[#c9a15a]/15 px-3 py-2 text-[12.5px] text-[#7a5a1f]">
          <Lightbulb className="size-4 shrink-0" aria-hidden="true" />
          {c.tip}
        </p>
      </div>
    </div>
  );
}
