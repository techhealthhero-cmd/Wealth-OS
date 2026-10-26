import { describe, expect, it } from "vitest";
import { prepareSlipImage } from "@/features/capture/lib/slip-image";

describe("prepareSlipImage", () => {
  it("returns the original blob where there is no document canvas", async () => {
    const blob = new Blob(["not-an-image"], { type: "image/heic" });
    await expect(prepareSlipImage(blob)).resolves.toBe(blob);
  });
});
