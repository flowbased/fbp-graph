FBP Graph library for JavaScript [![Build Status](https://travis-ci.org/flowbased/fbp-graph.svg?branch=master)](https://travis-ci.org/flowbased/fbp-graph) [![Greenkeeper badge](https://badges.greenkeeper.io/flowbased/fbp-graph.svg)](https://greenkeeper.io/) [![Coverage Status](https://coveralls.io/repos/github/flowbased/fbp-graph/badge.svg?branch=master)](https://coveralls.io/github/flowbased/fbp-graph?branch=master)
================================

This library provides a JavaScript implementation of Flow-Based Programming graphs. There are two areas covered:

* `Graph` - the actual graph library
* `Journal` - journal system for keeping track of graph changes and undo history

## Installing

Install fbp-graph with:

```
npm install fbp-graph --save
```

## Usage

Load a graph definition into an object. Loading graph definitions works with both JSON and FBP formatted graphs.

```javascript
var fbpGraph = require('fbp-graph');
fbpGraph.graph.loadFile('some/path.json',{}, function (err, graph) {
});
```
