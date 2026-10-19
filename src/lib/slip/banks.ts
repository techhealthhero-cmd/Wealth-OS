/** Stable identifiers independent of bank display names. */
export enum BankCode {
  KBANK = "KBANK", SCB = "SCB", KTB = "KTB", BBL = "BBL", BAY = "BAY",
  TTB = "TTB", GSB = "GSB", UOB = "UOB", CIMB = "CIMB", KKP = "KKP",
  LH = "LH", BAAC = "BAAC", GHB = "GHB",
}
const aliases: [BankCode, RegExp][] = [
  [BankCode.KBANK, /กสิกรไทย|\b(?:kbank|kasikorn)\b/i],
  [BankCode.SCB, /ไทยพาณิชย์|\b(?:scb|siam commercial)\b/i],
  [BankCode.KTB, /กรุงไทย|\b(?:ktb|krungthai)\b/i],
  [BankCode.BBL, /กรุงเทพ|\b(?:bbl|bangkok bank)\b/i],
  [BankCode.BAY, /กรุงศรี|\b(?:bay|krungsri)\b/i],
  [BankCode.TTB, /ทีทีบี|ทหารไทยธนชาต|\bttb\b/i],
  [BankCode.GSB, /ออมสิน|\b(?:gsb|government savings)\b/i],
  [BankCode.UOB, /ยูโอบี|\buob\b/i], [BankCode.CIMB, /ซีไอเอ็มบี|\bcimb\b/i],
  [BankCode.KKP, /เกียรตินาคิน|\bkkp\b/i], [BankCode.LH, /แลนด์แอนด์เฮ้าส์|\blh bank\b/i],
  [BankCode.BAAC, /ธ\.?ก\.?ส\.?|\bbaac\b/i], [BankCode.GHB, /ธอส\.?|\bghb\b/i],
];
export function detectBank(text: string): BankCode | null {
  return aliases.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}
