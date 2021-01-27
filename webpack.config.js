const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: 'development',
  target: 'node',
  entry: './dist/index.js',
  devtool: 'inline-source-map',
  output: {
    path: path.resolve(__dirname, 'dist/'),
    filename: 'index.js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    alias: { '@src': path.resolve(__dirname, 'dist/') }
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
      { test: /\.(js|ts)x?$/, exclude: /node_modules/, use: ['babel-loader'] }
    ]
  },
  plugins: [new CleanWebpackPlugin()]
};
