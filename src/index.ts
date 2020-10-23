const journal = require('./lib/Journal');
const graph = require('./lib/Graph');
const { Journal } = journal;
const { Graph } = graph;

exports.journal = {
  ...journal,
};
exports.graph = {
  ...graph,
};

exports.Graph = Graph;
exports.Journal = Journal;
