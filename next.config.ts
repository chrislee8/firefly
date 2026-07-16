import type { NextConfig } from "next";

// Content-Security-Policy.
//
// NOTE on 'unsafe-inline' in script-src: Next's App Router hydration inlines
// scripts (self.__next_f.push(...)) and @next/third-parties injects GA inline,
// so a strict policy would need a per-request nonce — which means giving up
// static rendering on every page. Because 'unsafe-inline' is present, this CSP
// does NOT block javascript: URLs; the http(s) allowlist in lib/safe-url.ts is
// the actual defence there. What this policy does buy: no framing
// (clickjacking), no external script origins beyond GA, no plugins, and a
// locked-down base-uri/form-action.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  // next/font self-hosts at build time, so no external font origin is needed.
  "font-src 'self' data:",
  // blob:/data: cover three.js canvas textures; https: keeps source favicons working.
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Legacy companion to frame-ancestors, for older browsers.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // No Strict-Transport-Security here on purpose: Vercel already serves
  // `max-age=63072000; includeSubDomains; preload` at the platform layer.
  // Setting a weaker value here risks downgrading it.
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // drop the X-Powered-By: Next.js banner
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
