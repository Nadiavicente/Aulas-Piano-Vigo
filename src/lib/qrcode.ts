import "server-only";
import QRCode from "qrcode";

export function getLoginUrl(email: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/login?email=${encodeURIComponent(email)}`;
}

export async function generateLoginQrDataUrl(email: string): Promise<string> {
  return QRCode.toDataURL(getLoginUrl(email), { margin: 1, width: 240 });
}
