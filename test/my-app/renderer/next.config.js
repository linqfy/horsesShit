/** @type {import('next').NextConfig} */

const withTM = require('next-transpile-modules')([
  'antd',
  'rc-util',
  'rc-virtual-list',
  'rc-menu',
  'rc-dropdown',
  'rc-pagination',
  'rc-select',
  'rc-tree',
  'rc-picker',
  'rc-tooltip',
  'rc-table',
  'rc-input',
  '@ant-design/icons',
  '@ant-design/icons-svg'
]);


module.exports = withTM({
  output: 'export',
  distDir: process.env.NODE_ENV === 'production' ? '../app' : '.next',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
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
