let browser; let chai; let lib;
if ((typeof process !== 'undefined') && process.execPath && process.execPath.match(/node|iojs/)) {
  // eslint-disable-next-line global-require
  if (!chai) { chai = require('chai'); }
  // eslint-disable-next-line global-require
  lib = require('../index');
  browser = false;
} else {
  // eslint-disable-next-line global-require,import/no-unresolved
  lib = require('fbp-graph');
  browser = true;
}

describe('FBP Graph', () => {
  describe('Unnamed graph instance', () => it('should have an empty name', () => {
    const g = new lib.graph.Graph();
    chai.expect(g.name).to.equal('');
  }));
  describe('with new instance', () => {
    let g = null;
    it('should get a name from constructor', () => {
      g = new lib.graph.Graph('Foo bar', { caseSensitive: true });
      chai.expect(g.name).to.equal('Foo bar');
    });

    it('should have no nodes initially', () => {
      chai.expect(g.nodes).to.eql([]);
    });
    it('should have no edges initially', () => {
      chai.expect(g.edges).to.eql([]);
    });
    it('should have no initializers initially', () => {
      chai.expect(g.initializers).to.eql([]);
    });
    it('should have no inports initially', () => {
      chai.expect(g.inports).to.eql({});
    });
    it('should have no outports initially', () => {
      chai.expect(g.outports).to.eql({});
    });

    describe('New node', () => {
      let n = null;
      it('should emit an event', (done) => {
        g.once('addNode', (node) => {
          chai.expect(node.id).to.equal('Foo');
          chai.expect(node.component).to.equal('Bar');
          n = node;
          done();
        });
        g.addNode('Foo', 'Bar');
      });
      it('should be in graph\'s list of nodes', () => {
        chai.expect(g.nodes.length).to.equal(1);
        chai.expect(g.nodes.indexOf(n)).to.equal(0);
      });
      it('should be accessible via the getter', () => {
        const node = g.getNode('Foo');
        chai.expect(node.id).to.equal('Foo');
        chai.expect(node).to.equal(n);
      });
      it('should have empty metadata', () => {
        const node = g.getNode('Foo');
        chai.expect(JSON.stringify(node.metadata)).to.equal('{}');
        chai.expect(node.display).to.equal(undefined);
      });
      it('should be available in the JSON export', () => {
        const json = g.toJSON();
        chai.expect(typeof json.processes.Foo).to.equal('object');
        chai.expect(json.processes.Foo.component).to.equal('Bar');
        chai.expect(json.processes.Foo.display).to.be.a('undefined');
      });
      it('removing should emit an event', (done) => {
        g.once('removeNode', (node) => {
          chai.expect(node.id).to.equal('Foo');
          chai.expect(node).to.equal(n);
          done();
        });
        g.removeNode('Foo');
      });
      it('should not be available after removal', () => {
        const node = g.getNode('Foo');
        chai.expect(node).to.be.a('undefined');
        chai.expect(g.nodes.length).to.equal(0);
        chai.expect(g.nodes.indexOf(n)).to.equal(-1);
      });
    });
    describe('New edge', () => {
      it('should emit an event', (done) => {
        g.addNode('Foo', 'foo');
        g.addNode('Bar', 'bar');
        g.once('addEdge', (edge) => {
          chai.expect(edge.from.node).to.equal('Foo');
          chai.expect(edge.to.port).to.equal('In');
          done();
        });
        g.addEdge('Foo', 'Out', 'Bar', 'In');
      });
      it('should add an edge', () => {
        g.addEdge('Foo', 'out', 'Bar', 'in2');
        chai.expect(g.edges.length).equal(2);
      });
      it('should refuse to add a duplicate edge', () => {
        const edge = g.edges[0];
        g.addEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port);
        chai.expect(g.edges.length).equal(2);
      });
    });
    describe('New edge with index', () => {
      it('should emit an event', (done) => {
        g.once('addEdge', (edge) => {
          chai.expect(edge.from.node).to.equal('Foo');
          chai.expect(edge.to.port).to.equal('in');
          chai.expect(edge.to.index).to.equal(1);
          chai.expect(edge.from.index).to.be.an('undefined');
          chai.expect(g.edges.length).equal(3);
          done();
        });
        g.addEdgeIndex('Foo', 'out', null, 'Bar', 'in', 1);
      });
      it('should add an edge', () => {
        g.addEdgeIndex('Foo', 'out', 2, 'Bar', 'in2');
        chai.expect(g.edges.length).equal(4);
      });
    });
  });

  describe('loaded from JSON (with case sensitive port names)', () => {
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

    it('should produce a Graph when input is string', (done) => lib.graph.loadJSON(jsonString, (err, instance) => {
      if (err) {
        done(err);
        return;
      }
      g = instance;
      chai.expect(g).to.be.an('object');
      done();
    }));

    it('should produce a Graph when input is json', (done) => lib.graph.loadJSON(json, (err, instance) => {
      if (err) {
        done(err);
        return;
      }
      g = instance;
      chai.expect(g).to.be.an('object');
      done();
    }));

    it('should not mutate the inputted json object', (done) => {
      chai.expect(Object.keys(json.processes).length).to.equal(4);
      lib.graph.loadJSON(json, (err, instance) => {
        if (err) {
          done(err);
          return;
        }
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
        done();
      });
    });

    it('should have a name', () => chai.expect(g.name).to.equal('Example'));
    it('should have graph metadata intact', () => chai.expect(g.properties).to.eql({
      foo: 'Baz',
      bar: 'Foo',
    }));
    it('should produce same JSON when serialized', () => chai.expect(JSON.stringify(g.toJSON())).to.equal(JSON.stringify(json)));
    it('should allow modifying graph metadata', (done) => {
      g.once('changeProperties', (properties) => {
        chai.expect(properties).to.equal(g.properties);
        chai.expect(g.properties).to.eql({
          foo: 'Baz',
          bar: 'Bar',
          hello: 'World',
        });
        done();
      });
      g.setProperties({
        hello: 'World',
        bar: 'Bar',
      });
    });
    it('should contain four nodes', () => chai.expect(g.nodes.length).to.equal(4));
    it('the first Node should have its metadata intact', () => {
      const node = g.getNode('Foo');
      chai.expect(node.metadata).to.be.an('object');
      chai.expect(node.metadata.display).to.be.an('object');
      chai.expect(node.metadata.display.x).to.equal(100);
      chai.expect(node.metadata.display.y).to.equal(200);
      chai.expect(node.metadata.routes).to.be.an('array');
      chai.expect(node.metadata.routes).to.contain('one');
      chai.expect(node.metadata.routes).to.contain('two');
    });
    it('should allow modifying node metadata', (done) => {
      g.once('changeNode', (node) => {
        chai.expect(node.id).to.equal('Foo');
        chai.expect(node.metadata.routes).to.be.an('array');
        chai.expect(node.metadata.routes).to.contain('one');
        chai.expect(node.metadata.routes).to.contain('two');
        chai.expect(node.metadata.hello).to.equal('World');
        done();
      });
      g.setNodeMetadata('Foo',
        { hello: 'World' });
    });
    it('should contain two connections', () => chai.expect(g.edges.length).to.equal(2));
    it('the first Edge should have its metadata intact', () => {
      const edge = g.edges[0];
      chai.expect(edge.metadata).to.be.an('object');
      chai.expect(edge.metadata.route).equal('foo');
    });
    it('should allow modifying edge metadata', (done) => {
      const e = g.edges[0];
      g.once('changeEdge', (edge) => {
        chai.expect(edge).to.equal(e);
        chai.expect(edge.metadata.route).to.equal('foo');
        chai.expect(edge.metadata.hello).to.equal('World');
        done();
      });
      g.setEdgeMetadata(e.from.node, e.from.port, e.to.node, e.to.port,
        { hello: 'World' });
    });
    it('should contain four IIPs', () => {
      chai.expect(g.initializers.length).to.equal(4);
    });
    it('should contain one published inport', () => {
      chai.expect(Object.keys(g.inports).length).to.equal(1);
    });
    it('should contain one published outport', () => {
      chai.expect(Object.keys(g.outports).length).to.equal(1);
    });
    it('should keep the output export metadata intact', () => {
      const exp = g.outports.outPut;
      chai.expect(exp.metadata.x).to.equal(500);
      chai.expect(exp.metadata.y).to.equal(505);
    });
    it('should contain two groups', () => chai.expect(g.groups.length).to.equal(2));
    it('should allow modifying group metadata', (done) => {
      const group = g.groups[0];
      g.once('changeGroup', (grp) => {
        chai.expect(grp).to.equal(group);
        chai.expect(grp.metadata.label).to.equal('Main');
        chai.expect(grp.metadata.foo).to.equal('Bar');
        chai.expect(g.groups[1].metadata).to.eql({});
        done();
      });
      g.setGroupMetadata('first',
        { foo: 'Bar' });
    });
    it('should allow renaming groups', (done) => {
      const group = g.groups[0];
      g.once('renameGroup', (oldName, newName) => {
        chai.expect(oldName).to.equal('first');
        chai.expect(newName).to.equal('renamed');
        chai.expect(group.name).to.equal(newName);
        done();
      });
      g.renameGroup('first', 'renamed');
    });
    describe('renaming a node', () => {
      it('should emit an event', (done) => {
        g.once('renameNode', (oldId, newId) => {
          chai.expect(oldId).to.equal('Foo');
          chai.expect(newId).to.equal('Baz');
          done();
        });
        g.renameNode('Foo', 'Baz');
      });
      it('should be available with the new name', () => {
        chai.expect(g.getNode('Baz')).to.be.an('object');
      });
      it('shouldn\'t be available with the old name', () => {
        chai.expect(g.getNode('Foo')).to.be.a('undefined');
      });
      it('should have the edge still going from it', () => {
        let connection = null;
        g.edges.forEach((edge) => {
          if (edge.from.node === 'Baz') { connection = edge; }
        });
        chai.expect(connection).to.be.an('object');
      });
      it('should still be exported', () => chai.expect(g.inports.inPut.process).to.equal('Baz'));
      it('should still be grouped', () => {
        let groups = 0;
        g.groups.forEach((group) => {
          if (group.nodes.indexOf('Baz') !== -1) { groups += 1; }
        });
        chai.expect(groups).to.equal(1);
      });
      it('shouldn\'t be have edges with the old name', () => {
        let connection = null;
        g.edges.forEach((edge) => {
          if (edge.from.node === 'Foo') { connection = edge; }
          if (edge.to.node === 'Foo') { connection = edge; }
        });
        chai.expect(connection).to.be.a('null');
      });
      it('should have the IIP still going to it', () => {
        let iip = null;
        g.initializers.forEach((edge) => {
          if (edge.to.node === 'Baz') { iip = edge; }
        });
        chai.expect(iip).to.be.an('object');
      });
      it('shouldn\'t have IIPs going to the old name', () => {
        let iip = null;
        g.initializers.forEach((edge) => {
          if (edge.to.node === 'Foo') { iip = edge; }
        });
        chai.expect(iip).to.be.a('null');
      });
      it('shouldn\'t be grouped with the old name', () => {
        let groups = 0;
        g.groups.forEach((group) => {
          if (group.nodes.indexOf('Foo') !== -1) { groups += 1; }
        });
        chai.expect(groups).to.equal(0);
      });
    });
    describe('renaming an inport', () => {
      it('should emit an event', (done) => {
        g.once('renameInport', (oldName, newName) => {
          chai.expect(oldName).to.equal('inPut');
          chai.expect(newName).to.equal('opt');
          chai.expect(g.inports.inPut).to.be.an('undefined');
          chai.expect(g.inports.opt).to.be.an('object');
          chai.expect(g.inports.opt.process).to.equal('Baz');
          chai.expect(g.inports.opt.port).to.equal('inPut');
          done();
        });
        g.renameInport('inPut', 'opt');
      });
    });
    describe('renaming an outport', () => {
      it('should emit an event', (done) => {
        g.once('renameOutport', (oldName, newName) => {
          chai.expect(oldName).to.equal('outPut');
          chai.expect(newName).to.equal('foo');
          chai.expect(g.outports.outPut).to.be.an('undefined');
          chai.expect(g.outports.foo).to.be.an('object');
          chai.expect(g.outports.foo.process).to.equal('Bar');
          chai.expect(g.outports.foo.port).to.equal('outPut');
          done();
        });
        g.renameOutport('outPut', 'foo');
      });
    });
    describe('removing a node', () => {
      it('should emit an event', (done) => {
        g.once('removeNode', (node) => {
          chai.expect(node.id).to.equal('Baz');
          done();
        });
        g.removeNode('Baz');
      });
      it('shouldn\'t have edges left behind', () => {
        let connections = 0;
        g.edges.forEach((edge) => {
          if (edge.from.node === 'Baz') { connections += 1; }
          if (edge.to.node === 'Baz') { connections += 1; }
        });
        chai.expect(connections).to.equal(0);
      });
      it('shouldn\'t have IIPs left behind', () => {
        let connections = 0;
        g.initializers.forEach((edge) => {
          if (edge.to.node === 'Baz') { connections += 1; }
        });
        chai.expect(connections).to.equal(0);
      });
      it('shouldn\'t be grouped', () => {
        let groups = 0;
        g.groups.forEach((group) => {
          if (group.nodes.indexOf('Baz') !== -1) { groups += 1; }
        });
        chai.expect(groups).to.equal(0);
      });
      it('shouldn\'t affect other groups', () => {
        const otherGroup = g.groups[0];
        chai.expect(otherGroup.nodes.length).to.equal(2);
      });
    });
  });

  describe('with multiple connected ArrayPorts', () => {
    const g = new lib.graph.Graph();
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
    it('should allow a specific edge to be removed', () => {
      g.removeEdge('Split1', 'out', 'Merge2', 'in');
      chai.expect(g.edges.length).to.equal(3);
    });
    it('shouldn\'t contain the removed connection from Split1', () => {
      let connection = null;
      g.edges.forEach((edge) => {
        if ((edge.from.node === 'Split1') && (edge.to.node === 'Merge2')) {
          connection = edge;
        }
      });
      chai.expect(connection).to.equal(null);
    });
    it('should still contain the other connection from Split1', () => {
      let connection = null;
      g.edges.forEach((edge) => {
        if ((edge.from.node === 'Split1') && (edge.to.node === 'Merge1')) {
          connection = edge;
        }
      });
      chai.expect(connection).to.be.an('object');
    });
  });

  describe('with an Initial Information Packet', () => {
    const g = new lib.graph.Graph();
    g.addNode('Split', 'Split');
    g.addInitial('Foo', 'Split', 'in');
    it('should contain one node', () => chai.expect(g.nodes.length).to.equal(1));
    it('should contain no edges', () => chai.expect(g.edges.length).to.equal(0));
    it('should contain one IIP', () => chai.expect(g.initializers.length).to.equal(1));
    describe('on removing that IIP', () => {
      it('should emit a removeInitial event', (done) => {
        g.once('removeInitial', (iip) => {
          chai.expect(iip.from.data).to.equal('Foo');
          chai.expect(iip.to.node).to.equal('Split');
          chai.expect(iip.to.port).to.equal('in');
          done();
        });
        g.removeInitial('Split', 'in');
      });
      it('should contain no IIPs', () => chai.expect(g.initializers.length).to.equal(0));
    });
  });

  describe('with an Inport Initial Information Packet', () => {
    const g = new lib.graph.Graph();
    g.addNode('Split', 'Split');
    g.addInport('testinport', 'Split', 'in');
    g.addGraphInitial('Foo', 'testinport');
    it('should contain one node', () => chai.expect(g.nodes.length).to.equal(1));
    it('should contain no edges', () => chai.expect(g.edges.length).to.equal(0));
    it('should contain one IIP for the correct node', () => {
      chai.expect(g.initializers.length).to.equal(1);
      chai.expect(g.initializers[0].from.data).to.equal('Foo');
      chai.expect(g.initializers[0].to.node).to.equal('Split');
      chai.expect(g.initializers[0].to.port).to.equal('in');
    });
    describe('on removing that IIP', () => {
      it('should emit a removeInitial event', (done) => {
        g.once('removeInitial', (iip) => {
          chai.expect(iip.from.data).to.equal('Foo');
          chai.expect(iip.to.node).to.equal('Split');
          chai.expect(iip.to.port).to.equal('in');
          done();
        });
        g.removeGraphInitial('testinport');
      });
      it('should contain no IIPs', () => chai.expect(g.initializers.length).to.equal(0));
    });
    describe('on adding IIP for a non-existent inport', () => {
      g.addGraphInitial('Bar', 'nonexistent');
      it('should not add any IIP', () => chai.expect(g.initializers.length).to.equal(0));
    });
  });

  describe('with an indexed Inport Initial Information Packet', () => {
    const g = new lib.graph.Graph();
    g.addNode('Split', 'Split');
    g.addInport('testinport', 'Split', 'in');
    g.addGraphInitialIndex('Foo', 'testinport', 1);
    it('should contain one node', () => {
      chai.expect(g.nodes.length).to.equal(1);
    });
    it('should contain no edges', () => {
      chai.expect(g.edges).to.eql([]);
    });
    it('should contain one IIP for the correct node', () => {
      chai.expect(g.initializers.length).to.equal(1);
      chai.expect(g.initializers[0].from.data).to.equal('Foo');
      chai.expect(g.initializers[0].to.node).to.equal('Split');
      chai.expect(g.initializers[0].to.port).to.equal('in');
      chai.expect(g.initializers[0].to.index).to.equal(1);
    });
    describe('on removing that IIP', () => {
      it('should emit a removeInitial event', (done) => {
        g.once('removeInitial', (iip) => {
          chai.expect(iip.from.data).to.equal('Foo');
          chai.expect(iip.to.node).to.equal('Split');
          chai.expect(iip.to.port).to.equal('in');
          done();
        });
        g.removeGraphInitial('testinport');
      });
      it('should contain no IIPs', () => chai.expect(g.initializers.length).to.equal(0));
    });
    describe('on adding IIP for a non-existent inport', () => {
      g.addGraphInitialIndex('Bar', 'nonexistent', 1);
      it('should not add any IIP', () => chai.expect(g.initializers.length).to.equal(0));
    });
  });

  describe('with no nodes', () => {
    const g = new lib.graph.Graph();
    it('should not allow adding edges', () => {
      g.addEdge('Foo', 'out', 'Bar', 'in');
      chai.expect(g.edges).to.eql([]);
    });
    it('should not allow adding IIPs', () => {
      g.addInitial('Hello', 'Bar', 'in');
      chai.expect(g.initializers).to.eql([]);
    });
  });

  describe('saving and loading files', () => {
    describe('with .json suffix', () => {
      let originalGraph = null;
      let graphPath = null;
      before(function () {
        if (browser) {
          this.skip();
          return;
        }
        // eslint-disable-next-line global-require
        const path = require('path');
        graphPath = path.resolve(__dirname, 'foo.json');
      });
      after((done) => {
        if (browser) {
          done();
          return;
        }
        // eslint-disable-next-line global-require
        const fs = require('fs');
        fs.unlink(graphPath, done);
      });
      it('should be possible to save a graph to a file', (done) => {
        const g = new lib.graph.Graph();
        g.addNode('Foo', 'Bar');
        originalGraph = g.toJSON();
        g.save(graphPath, done);
      });
      it('should be possible to load a graph from a file', (done) => lib.graph.loadFile(graphPath, (err, g) => {
        if (err) {
          done(err);
          return;
        }
        chai.expect(g.toJSON()).to.eql(originalGraph);
        done();
      }));
    });
    describe('without .json suffix', () => {
      let graphPathLegacy = null;
      let graphPathLegacySuffix = null;
      let originalGraph = null;
      before(function () {
        if (browser) {
          this.skip();
          return;
        }
        // eslint-disable-next-line global-require
        const path = require('path');
        graphPathLegacy = path.resolve(__dirname, 'bar');
        graphPathLegacySuffix = path.resolve(__dirname, 'bar.json');
      });
      after((done) => {
        if (browser) {
          done();
          return;
        }
        // eslint-disable-next-line global-require
        const fs = require('fs');
        fs.unlink(graphPathLegacySuffix, done);
      });
      it('should be possible to save a graph to a file', (done) => {
        const g = new lib.graph.Graph();
        g.addNode('Foo', 'Bar');
        originalGraph = g.toJSON();
        g.save(graphPathLegacy, done);
      });
      it('should be possible to load a graph from a file', (done) => {
        lib.graph.loadFile(graphPathLegacySuffix, (err, g) => {
          if (err) {
            done(err);
            return;
          }
          chai.expect(g.toJSON()).to.eql(originalGraph);
          done();
        });
      });
    });
  });
});

describe('Case Insensitive Graph', () => {
  describe('Graph operations should convert port names to lowercase', () => {
    let g = null;
    beforeEach(() => {
      g = new lib.graph.Graph('Hola');
    });

    it('should have case sensitive property set to false', () => {
      chai.expect(g.caseSensitive).to.equal(false);
    });

    it('should have case insensitive ports on edges', (done) => {
      g.addNode('Foo', 'foo');
      g.addNode('Bar', 'bar');
      g.once('addEdge', (edge) => {
        chai.expect(edge.from.node).to.equal('Foo');
        chai.expect(edge.to.port).to.equal('input');
        chai.expect(edge.from.port).to.equal('output');

        g.once('removeEdge', () => {
          setTimeout(() => {
            chai.expect(g.edges).to.eql([]);
            done();
          }, 0);
        });

        g.removeEdge('Foo', 'outPut', 'Bar', 'inPut');
      });

      g.addEdge('Foo', 'outPut', 'Bar', 'inPut');
    });
  });
});
