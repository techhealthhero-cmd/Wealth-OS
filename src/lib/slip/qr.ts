import { BankCode } from "./banks";

export interface SlipQR { sendingBankCode: string; bankId?: BankCode; transRef: string }
const banks: Record<string, BankCode> = {
  "002": BankCode.BBL, "004": BankCode.KBANK, "006": BankCode.KTB,
  "011": BankCode.TTB, "014": BankCode.SCB, "025": BankCode.BAY,
  "022": BankCode.CIMB, "024": BankCode.UOB, "069": BankCode.KKP,
  "073": BankCode.LH, "030": BankCode.GSB, "033": BankCode.GHB, "034": BankCode.BAAC,
};
/** CRC-16/CCITT-FALSE, including the CRC tag/length but excluding its value. */
export function slipCRC(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function tlv(text: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  for (let pos = 0; pos < text.length;) {
    const header = text.slice(pos, pos + 4);
    if (!/^\d{4}$/.test(header)) return null;
    const tag = header.slice(0, 2), length = Number(header.slice(2));
    if (!length || fields.has(tag) || pos + 4 + length > text.length) return null;
    fields.set(tag, text.slice(pos + 4, pos + 4 + length));
    pos += 4 + length;
  }
  return fields;
}
/** Standard bank mini-QR only; CRC is integrity evidence, not bank verification.
 * Format: https://developer.scb/assets/documents/documentation/qr-payment/extracting-data-from-mini-qr.pdf
 * https://thai-qr-payment.js.org/guide/slip-verify/
 */
export function parseSlipQR(payload: string): SlipQR | null {
  if (payload.length > 200 || !/^[\x20-\x7e]+$/.test(payload)) return null;
  const crc = /91(0[1-4])([\da-fA-F]{1,4})$/.exec(payload);
  if (!crc || Number(crc[1]) !== crc[2].length) return null;
  if (slipCRC(payload.slice(0, -crc[2].length)) !== crc[2].toUpperCase().padStart(4, "0")) return null;
  const root = tlv(payload);
  if (!root || root.get("91") !== crc[2] || [...root.keys()][0] !== "00" || [...root.keys()].at(-1) !== "91" || [...root.keys()].some(tag => !["00", "51", "91"].includes(tag)) || (root.has("51") && root.get("51") !== "TH")) return null;
  const data = tlv(root.get("00") ?? "");
  const sendingBankCode = data?.get("01"), transRef = data?.get("02");
  if (data?.size !== 3 || data.get("00") !== "000001" || !sendingBankCode || !/^\d{3}$/.test(sendingBankCode) || !transRef || transRef.length > 25) return null;
  return { sendingBankCode, ...(banks[sendingBankCode] ? { bankId: banks[sendingBankCode] } : {}), transRef };
}
