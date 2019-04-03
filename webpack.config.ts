import * as path from 'path';
import * as webpack from 'webpack';
import ZipPlugin from 'zip-webpack-plugin';
import nodeExternals from 'webpack-node-externals';

// Sets default params
const develop = process.env.NODE_ENV !== 'production';
const outDir = path.resolve(__dirname, 'bin');

// The configuration used by the other modules
const commonConfig: webpack.Configuration = {
  target: 'node',
  context: path.resolve(__dirname, './src'),
  mode: develop ? 'development' : 'production',
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      {test: /\.tsx?$/, loaders: ['ts-loader'], exclude: /node_modules/},
      {test: /\.json$/, loaders: ['json-loader'], exclude: /node_modules/}
    ]
  },
  watchOptions: {
    ignored: [/node_modules/]
  }
};

const httpHandlerConfig: webpack.Configuration = {
  ...commonConfig,
  entry: [
    './lambda/handler/http-handler/index.ts',
  ],
  output: {
    filename: 'http-handler.bundle.js',
    path: outDir
  },
  plugins: [
    new ZipPlugin({
      include: /\.js(\?.*)?$/i
    })
  ]
};

const streamHandlerConfig: webpack.Configuration = {
  ...commonConfig,
  entry: [
    './lambda/handler/stream-handler/index.ts'
  ],
  output: {
    filename: 'stream-handler.bundle.js',
    path: outDir
  },
  plugins: [
    new ZipPlugin({
      include: /\.js(\?.*)?$/i
    })
  ]
};

// The CloudFormation stack configuration
const stackConfig: webpack.Configuration = {
  ...commonConfig,
  entry: './stack/CloudFormation.ts',
  output: {
    filename: 'CloudFormation.js',
    path: outDir
  },
  // Tells webpack to not to bundle since we're running CDK locallys
  externals: [nodeExternals()]
};

export default [stackConfig, httpHandlerConfig, streamHandlerConfig];
