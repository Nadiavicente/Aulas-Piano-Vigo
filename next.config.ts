import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse depende de pdfjs-dist / @napi-rs/canvas, que incluyen un
  // binario nativo. Si Next.js intenta empaquetarlos, la carga falla en el
  // runtime serverless de Vercel — los dejamos como dependencias nativas.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
