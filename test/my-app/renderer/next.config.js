/** @type {import('next').NextConfig} */

const withTM = require('next-transpile-modules')([
  '@ant-design/icons',
  '@ant-design/icons-svg',
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
]);



module.exports = withTM({
  output: 'export',
  distDir: process.env.NODE_ENV === 'production' ? '../app' : '.next',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    return config
  },
})
