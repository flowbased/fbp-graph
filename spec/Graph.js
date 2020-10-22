/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let browser, chai, lib;
if ((typeof process !== 'undefined') && process.execPath && process.execPath.match(/node|iojs/)) {
  if (!chai) { chai = require('chai'); }
  lib = require('../index');
  browser = false;
} else {
  lib = require('fbp-graph');
  browser = true;
}

describe('FBP Graph', function() {
  describe('Unnamed graph instance', () => it('should have an empty name', function() {
    const g = new lib.graph.Graph;
    return chai.expect(g.name).to.equal('');
  }));
  describe('with new instance', function() {
    let g = null;
    it('should get a name from constructor', function() {
      g = new lib.graph.Graph('Foo bar', {caseSensitive: true});
      return chai.expect(g.name).to.equal('Foo bar');
    });

    it('should have no nodes initially', () => chai.expect(g.nodes.length).to.equal(0));
    it('should have no edges initially', () => chai.expect(g.edges.length).to.equal(0));
    it('should have no initializers initially', () => chai.expect(g.initializers.length).to.equal(0));
    it('should have no exports initially', function() {
      chai.expect(g.inports).to.be.empty;
      return chai.expect(g.outports).to.be.empty;
    });

    describe('New node', function() {
      let n = null;
      it('should emit an event', function(done) {
        g.once('addNode', function(node) {
          chai.expect(node.id).to.equal('Foo');
          chai.expect(node.component).to.equal('Bar');
          n = node;
          return done();
        });
        return g.addNode('Foo', 'Bar');
      });
      it('should be in graph\'s list of nodes', function() {
        chai.expect(g.nodes.length).to.equal(1);
        return chai.expect(g.nodes.indexOf(n)).to.equal(0);
      });
      it('should be accessible via the getter', function() {
        const node = g.getNode('Foo');
        chai.expect(node.id).to.equal('Foo');
        return chai.expect(node).to.equal(n);
      });
      it('should have empty metadata', function() {
        const node = g.getNode('Foo');
        chai.expect(JSON.stringify(node.metadata)).to.equal('{}');
        return chai.expect(node.display).to.equal(undefined);
      });
      it('should be available in the JSON export', function() {
        const json = g.toJSON();
        chai.expect(typeof json.processes.Foo).to.equal('object');
        chai.expect(json.processes.Foo.component).to.equal('Bar');
        return chai.expect(json.processes.Foo.display).to.not.exist;
      });
      it('removing should emit an event', function(done) {
        g.once('removeNode', function(node) {
          chai.expect(node.id).to.equal('Foo');
          chai.expect(node).to.equal(n);
          return done();
        });
        return g.removeNode('Foo');
      });
      return it('should not be available after removal', function() {
        const node = g.getNode('Foo');
        chai.expect(node).to.not.exist;
        chai.expect(g.nodes.length).to.equal(0);
        return chai.expect(g.nodes.indexOf(n)).to.equal(-1);
      });
    });
    describe('New edge', function() {
      it('should emit an event', function(done) {
        g.addNode('Foo', 'foo');
        g.addNode('Bar', 'bar');
        g.once('addEdge', function(edge) {
          chai.expect(edge.from.node).to.equal('Foo');
          chai.expect(edge.to.port).to.equal('In');
          return done();
        });
        return g.addEdge('Foo', 'Out', 'Bar', 'In');
      });
      it('should add an edge', function() {
        g.addEdge('Foo', 'out', 'Bar', 'in2');
        return chai.expect(g.edges.length).equal(2);
      });
      return it('should refuse to add a duplicate edge', function() {
        const edge = g.edges[0];
        g.addEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port);
        return chai.expect(g.edges.length).equal(2);
      });
    });
    return describe('New edge with index', function() {
      it('should emit an event', function(done) {
        g.once('addEdge', function(edge) {
          chai.expect(edge.from.node).to.equal('Foo');
          chai.expect(edge.to.port).to.equal('in');
          chai.expect(edge.to.index).to.equal(1);
          chai.expect(edge.from.index).to.be.an('undefined');
          chai.expect(g.edges.length).equal(3);
          return done();
        });
        return g.addEdgeIndex('Foo', 'out', null, 'Bar', 'in', 1);
      });
      return it('should add an edge', function() {
        g.addEdgeIndex('Foo', 'out', 2, 'Bar', 'in2');
        return chai.expect(g.edges.length).equal(4);
      });
    });
  });

  describe('loaded from JSON (with case sensitive port names)', function() {
    const jsonString = `\
{
  "caseSensitive": true,
  "properties": {
    "name": "Example",
    "foo": "Baz",
    "bar": "Foo"
  },
  "inports": {
    "inPut": {
      "process": "Foo",
      "port": "inPut",
      "metadata": {
        "x": 5,
        "y": 100
      }
    }
  },
  "outports": {
    "outPut": {
      "process": "Bar",
      "port": "outPut",
      "metadata": {
        "x": 500,
        "y": 505
      }
    }
  },
  "groups": [
    {
      "name": "first",
      "nodes": [
        "Foo"
      ],
      "metadata": {
        "label": "Main"
      }
    },
    {
      "name": "second",
      "nodes": [
        "Foo2",
        "Bar2"
      ]
    }
  ],
  "processes": {
    "Foo": {
      "component": "Bar",
      "metadata": {
        "display": {
          "x": 100,
          "y": 200
        },
        "routes": [
          "one",
          "two"
        ],
        "hello": "World"
      }
    },
    "Bar": {
      "component": "Baz",
      "metadata": {}
    },
    "Foo2": {
      "component": "foo",
      "metadata": {}
    },
    "Bar2": {
      "component": "bar",
      "metadata": {}
    }
  },
  "connections": [
    {
      "src": {
        "process": "Foo",
        "port": "outPut"
      },
      "tgt": {
        "process": "Bar",
        "port": "inPut"
      },
      "metadata": {
        "route": "foo",
        "hello": "World"
      }
    },
    {
      "src": {
        "process": "Foo",
        "port": "out2"
      },
      "tgt": {
        "process": "Bar",
        "port": "in2",
        "index": 2
      },
      "metadata": {
        "route": "foo",
        "hello": "World"
      }
    },
    {
      "data": "Hello, world!",
      "tgt": {
        "process": "Foo",
        "port": "inPut"
      }
    },
    {
      "data": "Hello, world, 2!",
      "tgt": {
        "process": "Foo",
        "port": "in2"
      }
    },
    {
      "data": "Cheers, world!",
      "tgt": {
        "process": "Foo",
        "port": "arr",
        "index": 0
      }
    },
    {
      "data": "Cheers, world, 2!",
      "tgt": {
        "process": "Foo",
        "port": "arr",
        "index": 1
      }
    }
  ]
}\
`;
    const json = JSON.parse(jsonString);
    let g = null;

    it('should produce a Graph when input is string', done => lib.graph.loadJSON(jsonString, function(err, instance) {
      if (err) { return done(err); }
      g = instance;
      chai.expect(g).to.be.an('object');
      return done();
    }));

    it('should produce a Graph when input is json', done => lib.graph.loadJSON(json, function(err, instance) {
      if (err) { return done(err); }
      g = instance;
      chai.expect(g).to.be.an('object');
      return done();
    }));
        
    it('should not mutate the inputted json object', function(done) {
      chai.expect(Object.keys(json.processes).length).to.equal(4);
      return lib.graph.loadJSON(json, function(err, instance) {
        if (err) { return done(err); }
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');
        instance.addNode('Split1', 'Split');

        chai.expect(Object.keys(json.processes).length).to.equal(4);
        console.log(json);
        return done();
      });
    });

    it('should have a name', () => chai.expect(g.name).to.equal('Example'));
    it('should have graph metadata intact', () => chai.expect(g.properties).to.eql({
      foo: 'Baz',
      bar: 'Foo'
    }));
    it('should produce same JSON when serialized', () => chai.expect(JSON.stringify(g.toJSON())).to.equal(JSON.stringify(json)));
    it('should allow modifying graph metadata', function(done) {
      g.once('changeProperties', function(properties) {
        chai.expect(properties).to.equal(g.properties);
        chai.expect(g.properties).to.eql({
          foo: 'Baz',
          bar: 'Bar',
          hello: 'World'
        });
        return done();
      });
      return g.setProperties({
        hello: 'World',
        bar: 'Bar'
      });
    });
    it('should contain four nodes', () => chai.expect(g.nodes.length).to.equal(4));
    it('the first Node should have its metadata intact', function() {
      const node = g.getNode('Foo');
      chai.expect(node.metadata).to.be.an('object');
      chai.expect(node.metadata.display).to.be.an('object');
      chai.expect(node.metadata.display.x).to.equal(100);
      chai.expect(node.metadata.display.y).to.equal(200);
      chai.expect(node.metadata.routes).to.be.an('array');
      chai.expect(node.metadata.routes).to.contain('one');
      return chai.expect(node.metadata.routes).to.contain('two');
    });
    it('should allow modifying node metadata', function(done) {
      g.once('changeNode', function(node) {
        chai.expect(node.id).to.equal('Foo');
        chai.expect(node.metadata.routes).to.be.an('array');
        chai.expect(node.metadata.routes).to.contain('one');
        chai.expect(node.metadata.routes).to.contain('two');
        chai.expect(node.metadata.hello).to.equal('World');
        return done();
      });
      return g.setNodeMetadata('Foo',
        {hello: 'World'});
    });
    it('should contain two connections', () => chai.expect(g.edges.length).to.equal(2));
    it('the first Edge should have its metadata intact', function() {
      const edge = g.edges[0];
      chai.expect(edge.metadata).to.be.an('object');
      return chai.expect(edge.metadata.route).equal('foo');
    });
    it('should allow modifying edge metadata', function(done) {
      const e = g.edges[0];
      g.once('changeEdge', function(edge) {
        chai.expect(edge).to.equal(e);
        chai.expect(edge.metadata.route).to.equal('foo');
        chai.expect(edge.metadata.hello).to.equal('World');
        return done();
      });
      return g.setEdgeMetadata(e.from.node, e.from.port, e.to.node, e.to.port,
        {hello: 'World'});
    });
    it('should contain four IIPs', () => chai.expect(g.initializers.length).to.equal(4));
    it('should contain one published inport', () => chai.expect(g.inports).to.not.be.empty);
    it('should contain one published outport', () => chai.expect(g.outports).to.not.be.empty);
    it('should keep the output export metadata intact', function() {
      const exp = g.outports.outPut;
      chai.expect(exp.metadata.x).to.equal(500);
      return chai.expect(exp.metadata.y).to.equal(505);
    });
    it('should contain two groups', () => chai.expect(g.groups.length).to.equal(2));
    it('should allow modifying group metadata', function(done) {
      const group = g.groups[0];
      g.once('changeGroup', function(grp) {
        chai.expect(grp).to.equal(group);
        chai.expect(grp.metadata.label).to.equal('Main');
        chai.expect(grp.metadata.foo).to.equal('Bar');
        chai.expect(g.groups[1].metadata).to.be.empty;
        return done();
      });
      return g.setGroupMetadata('first',
        {foo: 'Bar'});
    });
    it('should allow renaming groups', function(done) {
      const group = g.groups[0];
      g.once('renameGroup', function(oldName, newName) {
        chai.expect(oldName).to.equal('first');
        chai.expect(newName).to.equal('renamed');
        chai.expect(group.name).to.equal(newName);
        return done();
      });
      return g.renameGroup('first', 'renamed');
    });
    describe('renaming a node', function() {
      it('should emit an event', function(done) {
        g.once('renameNode', function(oldId, newId) {
          chai.expect(oldId).to.equal('Foo');
          chai.expect(newId).to.equal('Baz');
          return done();
        });
        return g.renameNode('Foo', 'Baz');
      });
      it('should be available with the new name', () => chai.expect(g.getNode('Baz')).to.be.an('object'));
      it('shouldn\'t be available with the old name', () => chai.expect(g.getNode('Foo')).to.be.null);
      it('should have the edge still going from it', function() {
        let connection = null;
        for (let edge of Array.from(g.edges)) {
          if (edge.from.node === 'Baz') { connection = edge; }
        }
        return chai.expect(connection).to.be.an('object');
      });
      it('should still be exported', () => chai.expect(g.inports.inPut.process).to.equal('Baz'));
      it('should still be grouped', function() {
        let groups = 0;
        for (let group of Array.from(g.groups)) {
          if (group.nodes.indexOf('Baz') !== -1) { groups++; }
        }
        return chai.expect(groups).to.equal(1);
      });
      it('shouldn\'t be have edges with the old name', function() {
        let connection = null;
        for (let edge of Array.from(g.edges)) {
          if (edge.from.node === 'Foo') { connection = edge; }
          if (edge.to.node === 'Foo') { connection = edge; }
        }
        return chai.expect(connection).to.be.a('null');
      });
      it('should have the IIP still going to it', function() {
        let iip = null;
        for (let edge of Array.from(g.initializers)) {
          if (edge.to.node === 'Baz') { iip = edge; }
        }
        return chai.expect(iip).to.be.an('object');
      });
      it('shouldn\'t have IIPs going to the old name', function() {
        let iip = null;
        for (let edge of Array.from(g.initializers)) {
          if (edge.to.node === 'Foo') { iip = edge; }
        }
        return chai.expect(iip).to.be.a('null');
      });
      return it('shouldn\'t be grouped with the old name', function() {
        let groups = 0;
        for (let group of Array.from(g.groups)) {
          if (group.nodes.indexOf('Foo') !== -1) { groups++; }
        }
        return chai.expect(groups).to.equal(0);
      });
    });
    describe('renaming an inport', () => it('should emit an event', function(done) {
      g.once('renameInport', function(oldName, newName) {
        chai.expect(oldName).to.equal('inPut');
        chai.expect(newName).to.equal('opt');
        chai.expect(g.inports.inPut).to.be.an('undefined');
        chai.expect(g.inports.opt).to.be.an('object');
        chai.expect(g.inports.opt.process).to.equal('Baz');
        chai.expect(g.inports.opt.port).to.equal('inPut');
        return done();
      });
      return g.renameInport('inPut', 'opt');
    }));
    describe('renaming an outport', () => it('should emit an event', function(done) {
      g.once('renameOutport', function(oldName, newName) {
        chai.expect(oldName).to.equal('outPut');
        chai.expect(newName).to.equal('foo');
        chai.expect(g.outports.outPut).to.be.an('undefined');
        chai.expect(g.outports.foo).to.be.an('object');
        chai.expect(g.outports.foo.process).to.equal('Bar');
        chai.expect(g.outports.foo.port).to.equal('outPut');
        return done();
      });
      return g.renameOutport('outPut', 'foo');
    }));
    return describe('removing a node', function() {
      it('should emit an event', function(done) {
        g.once('removeNode', function(node) {
          chai.expect(node.id).to.equal('Baz');
          return done();
        });
        return g.removeNode('Baz');
      });
      it('shouldn\'t have edges left behind', function() {
        let connections = 0;
        for (let edge of Array.from(g.edges)) {
          if (edge.from.node === 'Baz') { connections++; }
          if (edge.to.node === 'Baz') { connections++; }
        }
        return chai.expect(connections).to.equal(0);
      });
      it('shouldn\'t have IIPs left behind', function() {
        let connections = 0;
        for (let edge of Array.from(g.initializers)) {
          if (edge.to.node === 'Baz') { connections++; }
        }
        return chai.expect(connections).to.equal(0);
      });
      it('shouldn\'t be grouped', function() {
        let groups = 0;
        for (let group of Array.from(g.groups)) {
          if (group.nodes.indexOf('Baz') !== -1) { groups++; }
        }
        return chai.expect(groups).to.equal(0);
      });
      return it('shouldn\'t affect other groups', function() {
        const otherGroup = g.groups[1];
        return chai.expect(otherGroup.nodes.length).to.equal(2);
      });
    });
  });

  describe('with multiple connected ArrayPorts', function() {
    const g = new lib.graph.Graph;
    g.addNode('Split1', 'Split');
    g.addNode('Split2', 'Split');
    g.addNode('Merge1', 'Merge');
    g.addNode('Merge2', 'Merge');
    g.addEdge('Split1', 'out', 'Merge1', 'in');
    g.addEdge('Split1', 'out', 'Merge2', 'in');
    g.addEdge('Split2', 'out', 'Merge1', 'in');
    g.addEdge('Split2', 'out', 'Merge2', 'in');
    it('should contain four nodes', () => chai.expect(g.nodes.length).to.equal(4));
    it('should contain four edges', () => chai.expect(g.edges.length).to.equal(4));
    it('should allow a specific edge to be removed', function() {
      g.removeEdge('Split1', 'out', 'Merge2', 'in');
      return chai.expect(g.edges.length).to.equal(3);
    });
    it('shouldn\'t contain the removed connection from Split1', function() {
      let connection = null;
      for (let edge of Array.from(g.edges)) {
        if ((edge.from.node === 'Split1') && (edge.to.node === 'Merge2')) {
          connection = edge;
        }
      }
      return chai.expect(connection).to.be.null;
    });
    return it('should still contain the other connection from Split1', function() {
      let connection = null;
      for (let edge of Array.from(g.edges)) {
        if ((edge.from.node === 'Split1') && (edge.to.node === 'Merge1')) {
          connection = edge;
        }
      }
      return chai.expect(connection).to.be.an('object');
    });
  });

  describe('with an Initial Information Packet', function() {
    const g = new lib.graph.Graph;
    g.addNode('Split', 'Split');
    g.addInitial('Foo', 'Split', 'in');
    it('should contain one node', () => chai.expect(g.nodes.length).to.equal(1));
    it('should contain no edges', () => chai.expect(g.edges.length).to.equal(0));
    it('should contain one IIP', () => chai.expect(g.initializers.length).to.equal(1));
    return describe('on removing that IIP', function() {
      it('should emit a removeInitial event', function(done) {
        g.once('removeInitial', function(iip) {
          chai.expect(iip.from.data).to.equal('Foo');
          chai.expect(iip.to.node).to.equal('Split');
          chai.expect(iip.to.port).to.equal('in');
          return done();
        });
        return g.removeInitial('Split', 'in');
      });
      return it('should contain no IIPs', () => chai.expect(g.initializers.length).to.equal(0));
    });
  });

  describe('with an Inport Initial Information Packet', function() {
    const g = new lib.graph.Graph;
    g.addNode('Split', 'Split');
    g.addInport('testinport', 'Split', 'in');
    g.addGraphInitial('Foo', 'testinport');
    it('should contain one node', () => chai.expect(g.nodes.length).to.equal(1));
    it('should contain no edges', () => chai.expect(g.edges.length).to.equal(0));
    it('should contain one IIP for the correct node', function() {
      chai.expect(g.initializers.length).to.equal(1);
      chai.expect(g.initializers[0].from.data).to.equal('Foo');
      chai.expect(g.initializers[0].to.node).to.equal('Split');
      return chai.expect(g.initializers[0].to.port).to.equal('in');
    });
    describe('on removing that IIP', function() {
      it('should emit a removeInitial event', function(done) {
        g.once('removeInitial', function(iip) {
          chai.expect(iip.from.data).to.equal('Foo');
          chai.expect(iip.to.node).to.equal('Split');
          chai.expect(iip.to.port).to.equal('in');
          return done();
        });
        return g.removeGraphInitial('testinport');
      });
      return it('should contain no IIPs', () => chai.expect(g.initializers.length).to.equal(0));
    });
    return describe('on adding IIP for a non-existent inport', function() {
      g.addGraphInitial('Bar', 'nonexistent');
      return it('should not add any IIP', () => chai.expect(g.initializers.length).to.equal(0));
    });
  });

  describe('with an indexed Inport Initial Information Packet', function() {
    const g = new lib.graph.Graph;
    g.addNode('Split', 'Split');
    g.addInport('testinport', 'Split', 'in');
    g.addGraphInitialIndex('Foo', 'testinport', 1);
    it('should contain one node', () => chai.expect(g.nodes.length).to.equal(1));
    it('should contain no edges', () => chai.expect(g.edges.length).to.equal(0));
    it('should contain one IIP for the correct node', function() {
      chai.expect(g.initializers.length).to.equal(1);
      chai.expect(g.initializers[0].from.data).to.equal('Foo');
      chai.expect(g.initializers[0].to.node).to.equal('Split');
      chai.expect(g.initializers[0].to.port).to.equal('in');
      return chai.expect(g.initializers[0].to.index).to.equal(1);
    });
    describe('on removing that IIP', function() {
      it('should emit a removeInitial event', function(done) {
        g.once('removeInitial', function(iip) {
          chai.expect(iip.from.data).to.equal('Foo');
          chai.expect(iip.to.node).to.equal('Split');
          chai.expect(iip.to.port).to.equal('in');
          return done();
        });
        return g.removeGraphInitial('testinport');
      });
      return it('should contain no IIPs', () => chai.expect(g.initializers.length).to.equal(0));
    });
    return describe('on adding IIP for a non-existent inport', function() {
      g.addGraphInitialIndex('Bar', 'nonexistent', 1);
      return it('should not add any IIP', () => chai.expect(g.initializers.length).to.equal(0));
    });
  });

  describe('with no nodes', function() {
    const g = new lib.graph.Graph;
    it('should not allow adding edges', function() {
      g.addEdge('Foo', 'out', 'Bar', 'in');
      return chai.expect(g.edges).to.be.empty;
    });
    return it('should not allow adding IIPs', function() {
      g.addInitial('Hello', 'Bar', 'in');
      return chai.expect(g.initializers).to.be.empty;
    });
  });

  return describe('saving and loading files', function() {
    describe('with .json suffix', function() {
      let originalGraph = null;
      let graphPath = null;
      before(function() {
        if (browser) { return this.skip(); }
        const path = require('path');
        return graphPath = path.resolve(__dirname, 'foo.json');
      });
      after(function(done) {
        if (browser) { return done(); }
        const fs = require('fs');
        return fs.unlink(graphPath, done);
      });
      it('should be possible to save a graph to a file', function(done) {
        const g = new lib.graph.Graph;
        g.addNode('Foo', 'Bar');
        originalGraph = g.toJSON();
        return g.save(graphPath, done);
      });
      return it('should be possible to load a graph from a file', done => lib.graph.loadFile(graphPath, function(err, g) {
        if (err) { return done(err); }
        chai.expect(g.toJSON()).to.eql(originalGraph);
        return done();
      }));
    });
    return describe('without .json suffix', function() {
      let graphPathLegacy = null;
      let graphPathLegacySuffix = null;
      let originalGraph = null;
      before(function() {
        if (browser) { return this.skip(); }
        const path = require('path');
        graphPathLegacy = path.resolve(__dirname, 'bar');
        return graphPathLegacySuffix = path.resolve(__dirname, 'bar.json');
      });
      after(function(done) {
        if (browser) { return done(); }
        const fs = require('fs');
        return fs.unlink(graphPathLegacySuffix, done);
      });
      it('should be possible to save a graph to a file', function(done) {
        const g = new lib.graph.Graph;
        g.addNode('Foo', 'Bar');
        originalGraph = g.toJSON();
        return g.save(graphPathLegacy, done);
      });
      return it('should be possible to load a graph from a file', done => lib.graph.loadFile(graphPathLegacySuffix, function(err, g) {
        if (err) { return done(err); }
        chai.expect(g.toJSON()).to.eql(originalGraph);
        return done();
      }));
    });
  });
});

describe('Case Insensitive Graph', () => describe('Graph operations should convert port names to lowercase', function() {
  let g = null;
  beforeEach(() => g = new lib.graph.Graph('Hola'));

  it('should have case sensitive property set to false', () => chai.expect(g.caseSensitive).to.equal(false));

  return it('should have case insensitive ports on edges', function(done) {
    g.addNode('Foo', 'foo');
    g.addNode('Bar', 'bar');
    g.once('addEdge', function(edge) {
      chai.expect(edge.from.node).to.equal('Foo');
      chai.expect(edge.to.port).to.equal('input');
      chai.expect(edge.from.port).to.equal('output');

      g.once('removeEdge', function(edge) {
        chai.expect(g.edges.length).to.equal(0);
        return done();
      });

      return g.removeEdge('Foo', 'outPut', 'Bar', 'inPut');
    });

    return g.addEdge('Foo', 'outPut', 'Bar', 'inPut');
  });
}));
