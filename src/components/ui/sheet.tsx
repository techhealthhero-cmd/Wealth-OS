"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  motion = "slide",
  ...props
}: SheetPrimitive.Backdrop.Props & { motion?: "slide" | "grow" }) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-(--motion-companion-open) ease-(--ease-companion) data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        motion === "grow"
          ? "data-ending-style:duration-(--motion-companion-close)"
          : "data-ending-style:duration-(--motion-close) data-ending-style:ease-(--ease-close)",
        className
      )}
      {...props}
    />
  )
}

// Slide (default): closing — requested 2026-10-03 — slides the whole sheet
// off its edge, slowly and visibly (--motion-close), no fade, matching
// MinimizableFormShell. Opening (2026-10-04) slides fully in from its edge on
// the companion window's soft curve (--motion-companion-open /
// --ease-companion), so every window opens the same smooth way.
const SLIDE_MOTION =
  "transition duration-(--motion-companion-open) ease-(--ease-companion) data-ending-style:duration-(--motion-close) data-ending-style:ease-(--ease-close) data-[side=bottom]:data-ending-style:translate-y-full data-[side=bottom]:data-starting-style:translate-y-full data-[side=left]:data-ending-style:-translate-x-full data-[side=left]:data-starting-style:-translate-x-full data-[side=right]:data-ending-style:translate-x-full data-[side=right]:data-starting-style:translate-x-full data-[side=top]:data-ending-style:-translate-y-full data-[side=top]:data-starting-style:-translate-y-full"

// Grow (2026-10-04, "unfold like the companion window"): the sheet grows
// out of whatever opened it on the companion window's soft curve. The
// caller sets `transform-origin` on the element to the trigger's center.
// bottom/height also glide so a sheet that follows the iOS keyboard (Quick
// Capture) keeps moving smoothly.
//
// Closing is a "black hole" (requested same day — the old shrink left a
// small thumbnail sitting on the button): the sheet ACCELERATES into the
// trigger (ease-in, so it isn't left lingering tiny), spinning slightly,
// rounding into a disc and fading out over the last stretch. The
// caller raises the trigger above it while closing so it vanishes inside.
const GROW_MOTION =
  "[will-change:scale,opacity] [transition:scale_var(--motion-companion-open)_var(--ease-companion),opacity_220ms_ease-out,bottom_200ms_ease-out,height_200ms_ease-out,max-height_200ms_ease-out] data-starting-style:scale-[0.04] data-starting-style:opacity-0 data-ending-style:scale-[0.02] data-ending-style:opacity-0 data-ending-style:rotate-[-14deg] data-ending-style:rounded-[50%] data-ending-style:[transition:scale_var(--motion-companion-close)_var(--ease-black-hole),rotate_var(--motion-companion-close)_var(--ease-black-hole),border-radius_400ms_ease-in,opacity_220ms_ease-in_calc(var(--motion-companion-close)_-_220ms)]"

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  motion = "slide",
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  motion?: "slide" | "grow"
}) {
  return (
    <SheetPortal>
      <SheetOverlay motion={motion} />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          motion === "grow" ? GROW_MOTION : SLIDE_MOTION,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
