/** @type {import('next').NextConfig} */

// Headers de segurança (anti-clickjacking/iframe, nosniff, HSTS, referrer, permissões).
// frame-ancestors 'none' + X-Frame-Options DENY impedem embedding não autorizado do site.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pacific/shared'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  webpack: (config) => {
    // @pacific/shared usa imports ESM com extensão .js apontando para fontes .ts (NodeNext).
    // O webpack precisa mapear .js -> .ts/.tsx ao resolver módulos transpilados.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};
export default nextConfig;
