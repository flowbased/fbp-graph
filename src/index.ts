const journal = require('./Journal');
const graph = require('./Graph');
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
