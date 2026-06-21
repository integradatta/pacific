/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pacific/shared'],
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
