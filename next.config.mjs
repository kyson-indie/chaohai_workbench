/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 是原生模块，交给 Node 原样加载而不是打进打包产物
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
