import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep generated metadata in <head> for every user agent (including Lighthouse
  // and browser audits), instead of streaming it into <body> after the first HTML.
  htmlLimitedBots: /.*/,
  // Lets the self-hosted update worker build into a temporary directory and
  // switch the production build only after compilation and migrations succeed.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The gallery's custom loader serves only these responsive widths through
  // the media endpoint, which can return an existing derivative or create an
  // optimized WebP/AVIF fallback for legacy uploads.
  images: { deviceSizes: [320, 640, 960, 1280, 1600], imageSizes: [320] },
  // Keep Turbopack rooted in this project; a parent package-lock.json can otherwise
  // make it watch the user's home directory and fail to resolve the app routes.
  turbopack: { root: process.cwd() },
  experimental: {
    // Turbopack's persistent dev cache can get corrupted (notably on Windows / paths with spaces),
    // after which every compile panics with `PoisonError` in turbopack_ctx.rs. Disabling it keeps dev stable.
    turbopackFileSystemCacheForDev: false,
  },
  async redirects() {
    const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (!configured) return [];
    try {
      const canonical = new URL(/^https?:\/\//i.test(configured) ? configured : `https://${configured}`);
      if (canonical.protocol !== "https:" || !canonical.hostname.includes(".") || canonical.hostname === "localhost") return [];
      const host = canonical.hostname.toLowerCase();
      const alias = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
      const redirects: { source: string; destination: string; permanent: boolean; has: ({ type: "host"; value: string } | { type: "header"; key: string; value: string })[] }[] = [];
      redirects.push({ source: "/:path*", has: [{ type: "host", value: alias }], destination: `${canonical.origin}/:path*`, permanent: true });
      redirects.push({ source: "/:path*", has: [{ type: "host", value: host }, { type: "header", key: "x-forwarded-proto", value: "http" }], destination: `${canonical.origin}/:path*`, permanent: true });
      return redirects;
    } catch {
      return [];
    }
  },
};

export default nextConfig;
