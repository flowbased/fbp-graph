const webpack = require('webpack');
module.exports = (config) => {
  const configuration = {
    basePath: process.cwd(),
    frameworks: [
      'mocha',
      'chai',
    ],
    reporters: [
      'mocha',
    ],
    files: [
      'spec/*.js',
    ],
    preprocessors: {
      'spec/*.js': ['webpack'],
    },
    webpack: {
      plugins: [
        new webpack.IgnorePlugin(/tv4/),
      ],
      node: {
        fs: 'empty',
      },
    },
    browsers: ['ChromeHeadless'],
    logLevel: config.LOG_WARN,
    singleRun: true,
  };

  config.set(configuration);
};
