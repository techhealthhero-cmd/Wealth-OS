import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const blob = readFileSync("src/components/layout/floating-ai-button.tsx", "utf8");
const form = readFileSync("src/features/emergency-fund/components/emergency-fund-form.tsx", "utf8");
const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");

describe("emergency fund companion layout contract", () => {
  it("reserves a mobile gutter and docks restored, resized and dragged positions there", () => {
    expect(form).toContain('className="space-y-4 pr-16 md:pr-0"');
    expect(blob).toContain('pathname === "/plan/emergency-fund"');
    expect(blob).toContain("x: dockRight ? Math.max(maxX, EDGE_MARGIN_PX)");
    expect(blob).toContain("clampPosition(loadStoredPosition() ?? defaultPosition(), onEmergencyFundPage)");
    expect(blob).toContain("clampPosition(positionRef.current, onEmergencyFundPage)");
    expect(blob).toContain("clampPosition({ x: drag.originX + dx, y: drag.originY + dy }, onEmergencyFundPage)");
    expect(blob).toContain("clampPosition({ x: snappedX, y: current.y }, onEmergencyFundPage)");
    expect(blob).toContain("}, [onEmergencyFundPage]);");
    expect(blob).toContain("if (!onEmergencyFundPage) persist(snapped)");
  });

  it("retains input-focus hiding and the bottom safe-area reserve", () => {
    expect(blob).toContain('element.matches("input, textarea, select")');
    expect(blob).toContain("aria-hidden={editing || stepAside}");
    expect(blob).toContain("opacity: stepAside || editing ? 0");
    expect(layout).toContain("pb-[calc(11rem+env(safe-area-inset-bottom))]");
  });
});
