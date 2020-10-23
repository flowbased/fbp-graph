module.exports = {
  entry: './webpack.entry.js',
  output: {
    path: __dirname,
    filename: 'browser/fbp-graph.js',
  },
  resolve: {
    extensions: ['.js'],
    fallback: {
      fs: false,
      /*
      buffer: require.resolve('buffer/'),
      events: require.resolve('events/'),
      path: require.resolve('path-browserify'),
      url: require.resolve('url/'),
      */
    },
  },
  externals: {
  },
};
