import { linesFromText } from "../../src/lib/import/pdf/lines";
import type { StatementBankId } from "../../src/lib/import/pdf/types";

// Entirely synthetic. No customer identifiers or real statement data.
export const BANK_FIXTURES: Record<StatementBankId, string[]> = {
  kbank: ["K PLUS Kasikornbank", "01/10/2569 รับโอนเงิน 500.00 1500.00", "02/10/2569 โอนเงิน 100.00 1400.00"],
  scb: ["SCB Siam Commercial Bank", "01/10/26 credit interest 50.00", "02/10/26 paid 10.00"],
  bbl: ["Bangkok Bank ธนาคารกรุงเทพ", "01/10/2026 CDM 500.00", "02/10/2026 WD 100.00"],
  ktb: ["Krungthai NEXT", "01 ต.ค. 2569 รับเงินผ่าน NEXT 500.00", "02 ต.ค. 2569 โอนเงิน 100.00"],
  krungsri: ["Krungsri Bank of Ayudhya", "01/10/69 เงินฝาก 500.00", "02/10/69 ชำระสินค้า 100.00"],
  ttb: ["ttb TMBThanachart", "01/10/2026 credit transfer 500.00", "02/10/2026 debit transfer 100.00"],
  gsb: ["GSB Government Savings Bank ออมสิน", "01/10/2569 นำฝาก 500.00", "02/10/2569 ถอนผ่าน MyMo 100.00"],
};
export const fixtureLines = (bank: StatementBankId) => linesFromText(BANK_FIXTURES[bank]);
