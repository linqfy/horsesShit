// next.config.js
const withTM = require('next-transpile-modules')([
  'antd',
  '@ant-design/icons',
]);
const path = require('path');
const webpack = require('webpack');

module.exports = withTM({
  output: 'export',
  distDir: process.env.NODE_ENV === 'production' ? '../app' : '.next',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve = {
      ...config.resolve,
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
      modules: [
        'node_modules',
        path.resolve(__dirname, '../node_modules'),
        path.resolve(__dirname, 'node_modules'),
      ],
      fallback: {
        ...config.resolve.fallback,
        path: false,
        fs: false,
      },
      mainFields: ['module', 'main', 'browser'],
    };

    if (!isServer) {
      config.target = 'electron-renderer';
      config.node = {
        __dirname: true,
      };
      config.plugins = [
        ...config.plugins,
        new webpack.ProvidePlugin({
          React: 'react',
        }),
        new webpack.DefinePlugin({
          global: 'globalThis',
        })
      ];
    }
    config.output.globalObject = 'this';
    return config;
  },
});