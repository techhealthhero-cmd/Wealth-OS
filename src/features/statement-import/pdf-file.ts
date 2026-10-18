/** Inspect content before deciding whether any file may be uploaded. */
export async function isPdfFile(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return bytes.some((_, offset) => magic.every((value, index) => bytes[offset + index] === value))
    || /\.pdf$/i.test(file.name) || file.type === "application/pdf";
}
