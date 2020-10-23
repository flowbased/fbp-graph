module.exports = {
  entry: './webpack.entry.js',
  output: {
    path: __dirname,
    filename: 'browser/fbp-graph.js',
  },
  resolve: {
    extensions: ['.js'],
    fallback: {
      events: require.resolve('events/'),
      fs: false,
      tv4: false,
    },
  },
  externals: {
  },
};
