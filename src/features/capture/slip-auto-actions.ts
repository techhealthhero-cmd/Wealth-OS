"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { fetchAllPages, fetchInBatches } from "@/features/dashboard/lib/paged-fetch";
import type { SlipTransaction } from "@/lib/slip/types";

/** Only dates/references cross the wire. Images and OCR text stay on device. */
export async function getSlipCandidates(input: { dates: string[]; references: string[] }): Promise<SlipTransaction[]> {
  const { dates, references } = z.object({ dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(500), references: z.array(z.string().max(200)).max(500) }).parse(input);
  if (await getPrivacyGate("activity")) throw new Error("กรุณาปลดล็อกข้อมูลรายการก่อนอ่านสลิป");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  const fields = "id, type, amount, transaction_date, reference";
  const sorted = [...dates].sort();
  const rows: SlipTransaction[] = [];
  if (sorted.length) rows.push(...await fetchAllPages<SlipTransaction>(async (start, end) => {
    const { data, error } = await client.from("transactions").select(fields).eq("user_id", user.id)
      .gte("transaction_date", sorted[0]).lte("transaction_date", sorted[sorted.length - 1]).order("id").range(start, end);
    if (error) throw new Error("ไม่สามารถตรวจรายการซ้ำได้ กรุณาลองอีกครั้ง");
    return data ?? [];
  }));
  rows.push(...await fetchInBatches([...new Set(references)], refs => fetchAllPages<SlipTransaction>(async (start, end) => {
    const { data, error } = await client.from("transactions").select(fields).eq("user_id", user.id).in("reference", refs).order("id").range(start, end);
    if (error) throw new Error("ไม่สามารถตรวจรายการซ้ำได้ กรุณาลองอีกครั้ง");
    return data ?? [];
  })));
  return [...new Map(rows.map(row => [row.id, row])).values()];
}
