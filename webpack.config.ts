import * as path from 'path';
import * as webpack from 'webpack';
import nodeExternals from 'webpack-node-externals';

// Sets build constants
const HANDLER_MODULE = 'index';

// Sets common params
const isDevelop = process.env.NODE_ENV !== 'production';

const binDir = path.resolve(__dirname, 'bin');

function handlerConfig(baseConfig: webpack.Configuration, path: string): webpack.Configuration {
  return {
    ...baseConfig,
    entry: [
      `./lambda/handler/${path}/index.ts`,
    ],
    output: {
      path: `${binDir}/${path}`,
      filename: `${HANDLER_MODULE}.js`,
      libraryTarget: 'commonjs2',
      library: HANDLER_MODULE
    }
  }
}

// The configuration used by the other modules
const sharedConfig: webpack.Configuration = {
  target: 'node',
  context: path.resolve(__dirname, './src'),
  mode: isDevelop ? 'development' : 'production',
  devtool: false,
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

// The CloudFormation stack configuration
const stackConfig: webpack.Configuration = {
  ...sharedConfig,
  entry: './stack/CloudFormation.ts',
  output: {
    path: binDir,
    filename: 'CloudFormation.js',

  },
  // Tells webpack to not to bundle since we're running CDK locally
  externals: [nodeExternals()]
};

export default [stackConfig,
  handlerConfig(sharedConfig, 'stream-handler'),
  handlerConfig(sharedConfig, 'http-handler'),
];
