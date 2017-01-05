FBP Graph library for JavaScript
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
