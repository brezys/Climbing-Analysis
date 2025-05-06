/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // This is necessary to handle the MediaPipe libraries
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    
    // Add the html5-qrcode package to the transpiled modules
    // to avoid any issues with ES modules/CommonJS incompatibility
    config.module.rules.push({
      test: /node_modules\/html5-qrcode/,
      use: ['next-swc-loader'],
    });
    
    return config;
  },
  // Handle browser-only packages
  experimental: {
    esmExternals: 'loose',
  },
};

module.exports = nextConfig; 