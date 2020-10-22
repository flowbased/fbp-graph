/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let chai, lib;
if ((typeof process !== 'undefined') && process.execPath && process.execPath.match(/node|iojs/)) {
  if (!chai) { chai = require('chai'); }
  lib = require('../index');
} else {
  lib = require('fbp-graph');
}

describe('FBP Graph Journal', function() {
  describe('connected to initialized graph', function() {
    const g = new lib.graph.Graph;
    g.addNode('Foo', 'Bar');
    g.addNode('Baz', 'Foo');
    g.addEdge('Foo', 'out', 'Baz', 'in');
    const j = new lib.journal.Journal(g);
    return it('should have just the initial transaction', () => chai.expect(j.store.lastRevision).to.equal(0));
  });

  describe('following basic graph changes', function() {
    const g = new lib.graph.Graph;
    const j = new lib.journal.Journal(g);
    return it('should create one transaction per change', function() {
      g.addNode('Foo', 'Bar');
      g.addNode('Baz', 'Foo');
      g.addEdge('Foo', 'out', 'Baz', 'in');
      chai.expect(j.store.lastRevision).to.equal(3);
      g.removeNode('Baz');
      return chai.expect(j.store.lastRevision).to.equal(4);
    });
  });

  describe('pretty printing', function() {
    const g = new lib.graph.Graph;
    const j = new lib.journal.Journal(g);

    g.startTransaction('test1');
    g.addNode('Foo', 'Bar');
    g.addNode('Baz', 'Foo');
    g.addEdge('Foo', 'out', 'Baz', 'in');
    g.addInitial(42, 'Foo', 'in');
    g.removeNode('Foo');
    g.endTransaction('test1');

    g.startTransaction('test2');
    g.removeNode('Baz');
    g.endTransaction('test2');

    return it('should be human readable', function() {
      const ref = `>>> 0: initial
<<< 0: initial
>>> 1: test1
Foo(Bar)
Baz(Foo)
Foo out -> in Baz
'42' -> in Foo
META Foo out -> in Baz
Foo out -X> in Baz
'42' -X> in Foo
META Foo
DEL Foo(Bar)
<<< 1: test1`;
      return chai.expect(j.toPrettyString(0,2)).to.equal(ref);
    });
  });

  describe('jumping to revision', function() {
    const g = new lib.graph.Graph;
    const j = new lib.journal.Journal(g);
    g.addNode('Foo', 'Bar');
    g.addNode('Baz', 'Foo');
    g.addEdge('Foo', 'out', 'Baz', 'in');
    g.addInitial(42, 'Foo', 'in');
    g.removeNode('Foo');
    return it('should change the graph', function() {
      j.moveToRevision(0);
      chai.expect(g.nodes.length).to.equal(0);
      j.moveToRevision(2);
      chai.expect(g.nodes.length).to.equal(2);
      j.moveToRevision(5);
      return chai.expect(g.nodes.length).to.equal(1);
    });
  });

  describe('linear undo/redo', function() {
    const g = new lib.graph.Graph;
    const j = new lib.journal.Journal(g);
    g.addNode('Foo', 'Bar');
    g.addNode('Baz', 'Foo');
    g.addEdge('Foo', 'out', 'Baz', 'in');
    g.addInitial(42, 'Foo', 'in');
    const graphBeforeError = g.toJSON();
    chai.expect(g.nodes.length).to.equal(2);
    it('undo should restore previous revision', function() {
      g.removeNode('Foo');
      chai.expect(g.nodes.length).to.equal(1);
      j.undo();
      chai.expect(g.nodes.length).to.equal(2);
      return chai.expect(g.toJSON()).to.deep.equal(graphBeforeError);
    });
    it('redo should apply the same change again', function() {
      j.redo();
      return chai.expect(g.nodes.length).to.equal(1);
    });
    return it('undo should also work multiple revisions back', function() {
      g.removeNode('Baz');
      j.undo();
      j.undo();
      chai.expect(g.nodes.length).to.equal(2);
      return chai.expect(g.toJSON()).to.deep.equal(graphBeforeError);
    });
  });

  return describe('undo/redo of metadata changes', function() {
    const g = new lib.graph.Graph;
    const j = new lib.journal.Journal(g);
    g.addNode('Foo', 'Bar');
    g.addNode('Baz', 'Foo');
    g.addEdge('Foo', 'out', 'Baz', 'in');

    it('adding group', function() {
      g.addGroup('all', ['Foo', 'Bax'], {'label': 'all nodes'});
      chai.expect(g.groups.length).to.equal(1);
      return chai.expect(g.groups[0].name).to.equal('all');
    });
    it('undoing group add', function() {
      j.undo();
      return chai.expect(g.groups.length).to.equal(0);
    });
    it('redoing group add', function() {
      j.redo();
      return chai.expect(g.groups[0].metadata['label']).to.equal('all nodes');
    });

    it('changing group metadata adds revision', function() {
      const r = j.store.lastRevision;
      g.setGroupMetadata('all', {'label': 'ALL NODES!'});
      return chai.expect(j.store.lastRevision).to.equal(r+1);
    });
    it('undoing group metadata change', function() {
      j.undo();
      return chai.expect(g.groups[0].metadata['label']).to.equal("all nodes");
    });
    it('redoing group metadata change', function() {
      j.redo();
      return chai.expect(g.groups[0].metadata['label']).to.equal("ALL NODES!");
    });

    it('setting node metadata', function() {
      g.setNodeMetadata('Foo', {"oneone": 11, 2: "two"});
      return chai.expect(Object.keys(g.getNode('Foo').metadata).length).to.equal(2);
    });
    it('undoing set node metadata', function() {
      j.undo();
      return chai.expect(Object.keys(g.getNode('Foo').metadata).length).to.equal(0);
    });
    return it('redoing set node metadata', function() {
      j.redo();
      return chai.expect(g.getNode('Foo').metadata["oneone"]).to.equal(11);
    });
  });
});


describe('Journalling of graph merges', function() {
  const A = `\
{
"properties": { "name": "Example", "foo": "Baz", "bar": "Foo" },
"inports": {
  "in": { "process": "Foo", "port": "in", "metadata": { "x": 5, "y": 100 } }
},
"outports": {
  "out": { "process": "Bar", "port": "out", "metadata": { "x": 500, "y": 505 } }
},
"groups": [
  { "name": "first", "nodes": [ "Foo" ], "metadata": { "label": "Main" } },
  { "name": "second", "nodes": [ "Foo2", "Bar2" ], "metadata": {} }
],
"processes": {
  "Foo": { "component": "Bar", "metadata": { "display": { "x": 100, "y": 200 }, "hello": "World" } },
  "Bar": { "component": "Baz", "metadata": {} },
  "Foo2": { "component": "foo", "metadata": {} },
  "Bar2": { "component": "bar", "metadata": {} }
},
"connections": [
  { "src": { "process": "Foo", "port": "out" }, "tgt": { "process": "Bar", "port": "in" }, "metadata": { "route": "foo", "hello": "World" } },
  { "src": { "process": "Foo", "port": "out2" }, "tgt": { "process": "Bar", "port": "in2" } },
  { "data": "Hello, world!", "tgt": { "process": "Foo", "port": "in" } },
  { "data": "Hello, world, 2!", "tgt": { "process": "Foo", "port": "in2" } },
  { "data": "Cheers, world!", "tgt": { "process": "Foo", "port": "arr" } }
]
}`;

  const B = `\
{
"properties": { "name": "Example", "foo": "Baz", "bar": "Foo" },
"inports": {
  "in": { "process": "Foo", "port": "in", "metadata": { "x": 500, "y": 1 } }
},
"outports": {
  "out": { "process": "Bar", "port": "out", "metadata": { "x": 500, "y": 505 } }
},
"groups": [
  { "name": "second", "nodes": [ "Foo", "Bar" ] }
],
"processes": {
  "Foo": { "component": "Bar", "metadata": { "display": { "x": 100, "y": 200 }, "hello": "World" } },
  "Bar": { "component": "Baz", "metadata": {} },
  "Bar2": { "component": "bar", "metadata": {} },
  "Bar3": { "component": "bar2", "metadata": {} }
},
"connections": [
  { "src": { "process": "Foo", "port": "out" }, "tgt": { "process": "Bar", "port": "in" }, "metadata": { "route": "foo", "hello": "World" } },
  { "src": { "process": "Foo2", "port": "out2" }, "tgt": { "process": "Bar3", "port": "in2" } },
  { "data": "Hello, world!", "tgt": { "process": "Foo", "port": "in" } },
  { "data": "Hello, world, 2!", "tgt": { "process": "Bar3", "port": "in2" } },
  { "data": "Cheers, world!", "tgt": { "process": "Bar2", "port": "arr" } }
]
}`;
  let a = null;
  let b = null;
  let g = null; // one we modify
  let j = null;
  return describe('G -> B', function() {
    it('G starts out as A', done => lib.graph.loadJSON(JSON.parse(A), function(err, instance) {
      if (err) { return done(err); }
      a = instance;
      return lib.graph.loadJSON(JSON.parse(A), function(err, instance) {
        if (err) { return done(err); }
        g = instance;
        chai.expect(lib.graph.equivalent(a, g)).to.equal(true);
        return done();
      });
    }));
    it('G and B starts out different', done => lib.graph.loadJSON(JSON.parse(B), function(err, instance) {
      if (err) { return done(err); }
      b = instance;
      chai.expect(lib.graph.equivalent(g, b)).to.equal(false);
      return done();
    }));
    it('merge should make G equivalent to B', function(done) {
      j = new lib.journal.Journal(g);
      g.startTransaction('merge');
      lib.graph.mergeResolveTheirs(g, b);
      g.endTransaction('merge');
      chai.expect(lib.graph.equivalent(g, b)).to.equal(true);
      return done();
    });
    return it('undoing merge should make G equivalent to A again', function(done) {
      j.undo();
      const res = lib.graph.equivalent(g, a);
      chai.expect(res).to.equal(true);
      return done();
    });
  });
});

// FIXME: add tests for lib.graph.loadJSON/loadFile, and journal metadata

