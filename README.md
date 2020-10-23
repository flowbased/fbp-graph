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
const fbpGraph = require('fbp-graph');
fbpGraph.graph.loadFile('some/path.json', (err, graph) => {
  // Do something with the graph object
});
```

## Changes

* 0.5.0 (October 23rd 2020)
  - Converted from CoffeeScript to modern JavaScript
* 0.4.0 (December 7th 2018)
  - Original JSON loaded via `loadJSON` no longer gets mutated by the graph instance (thanks @davecarlson)
