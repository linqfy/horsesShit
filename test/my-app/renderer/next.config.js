/** @type {import('next').NextConfig} */

const withTM = require('next-transpile-modules')([
  'antd',
  '@ant-design/icons',
  'axios',
  'jspdf',
  'jspdf-autotable', 
  'moment'
]);


module.exports = withTM({
  output: 'export',
  distDir: process.env.NODE_ENV === 'production' ? '../app' : '.next',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,  // Disable React Strict Mode
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.target = 'electron-renderer';
    }
    return config;
  },

  typescript: {
    ignoreBuildErrors: true,
  },
})
