import "server-only";
import QRCode from "qrcode";

export function getLoginUrl(email: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/login?email=${encodeURIComponent(email)}`;
}

export async function generateLoginQrDataUrl(email: string): Promise<string> {
  return QRCode.toDataURL(getLoginUrl(email), { margin: 1, width: 240 });
}

// PNG en bruto (para adjuntar al email como imagen incrustada por Content-ID
// en vez de un data: URI base64 dentro del HTML, que muchos filtros
// antispam penalizan).
export async function generateLoginQrPngBuffer(email: string): Promise<Buffer> {
  return QRCode.toBuffer(getLoginUrl(email), { margin: 1, width: 240 });
}
