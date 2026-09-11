import { DecorativeBlob } from "./decorative-blob";
import { cn } from "@/lib/utils";

interface IllustrationFrameProps {
  size?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Composes `DecorativeBlob` behind any illustration — the single place this
 * happens, so every illustration gets the same soft backdrop treatment
 * instead of each one drawing its own background shape inline (which is
 * what every illustration used to do before this existed; removed to avoid
 * two overlapping soft shapes). This is what actually puts `DecorativeBlob`
 * to use — see GRAPHICS_PLAN.md's note on it previously being built but
 * unused.
 */
export function IllustrationFrame({ size = 160, className, children }: IllustrationFrameProps) {
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <DecorativeBlob size={size} className="absolute inset-0" />
      <div className="relative">{children}</div>
    </div>
  );
}
