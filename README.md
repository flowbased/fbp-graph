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

* 0.7.0 (December 08th 2020)
  - All graph modification methods are now chainable, allowing you to do things like `graph.addNode().addEdge().toJSON()`
  - Graph I/O methods (like `loadFile` and `save`) now return Promises in case no callback is supplied
* 0.6.3 (December 03rd 2020)
  - Fixed exporting of base Graph and Journal types in index
* 0.6.2 (November 16th 2020)
  - Graph properties `componentLoader` and `baseDir` are not serialized into JSON
* 0.6.1 (October 26th 2020)
  - Fixed packaging issue
* 0.6.0 (October 26th 2020)
  - Now shipping with TypeScript definitions
* 0.5.0 (October 23rd 2020)
  - Converted from CoffeeScript to modern JavaScript
* 0.4.0 (December 7th 2018)
  - Original JSON loaded via `loadJSON` no longer gets mutated by the graph instance (thanks @davecarlson)
