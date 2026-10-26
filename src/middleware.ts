import { NextResponse, type NextRequest } from "next/server";

/**
 * Política de Segurança de Conteúdo com nonce por requisição.
 * Só carregam scripts do próprio site; o pagamento com cartão acontece no ambiente do Mercado Pago (redirecionamento).
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://challenges.cloudflare.com https://www.google.com",
    "frame-ancestors 'none'",
    "form-action 'self' https://www.mercadopago.com.br https://*.mercadopago.com",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|logo.png|uploads|produtos|icons).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
