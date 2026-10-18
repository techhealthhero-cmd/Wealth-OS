import { expect, it } from "vitest";
import { isPdfFile } from "../src/features/statement-import/pdf-file";

it.each(["statement.csv", "statement", "statement.txt"])("detects PDF bytes regardless of filename %s", async (name) => {
  expect(await isPdfFile(new File(["prefix\n%PDF-1.7"], name, { type: "text/csv" }))).toBe(true);
});
it("checks the full first 1024 bytes", async () => {
  expect(await isPdfFile(new File([" ".repeat(1019) + "%PDF-"], "bank.csv"))).toBe(true);
  expect(await isPdfFile(new File(["date,amount\n2026-10-01,100"], "bank.csv"))).toBe(false);
});
it("keeps declared PDFs local even with a malformed signature", async () => {
  expect(await isPdfFile(new File(["invalid"], "bank.pdf"))).toBe(true);
  expect(await isPdfFile(new File(["invalid"], "bank.csv", { type: "application/pdf" }))).toBe(true);
});
