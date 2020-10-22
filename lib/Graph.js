/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//     FBP Graph
//     (c) 2013-2017 Flowhub UG
//     (c) 2011-2012 Henri Bergius, Nemein
//     FBP Graph may be freely distributed under the MIT license
//
// FBP graphs are Event Emitters, providing signals when the graph
// definition changes.
//
const {EventEmitter} = require('events');

const clone = require('clone');
const platform = require('./Platform');

// This class represents an abstract FBP graph containing nodes
// connected to each other with edges.
//
// These graphs can be used for visualization and sketching, but
// also are the way to start a NoFlo or other FBP network.
class Graph extends EventEmitter {
  static initClass() {
    this.prototype.name = '';
    this.prototype.caseSensitive = false;
    this.prototype.properties = {};
    this.prototype.nodes = [];
    this.prototype.edges = [];
    this.prototype.initializers = [];
    this.prototype.inports = {};
    this.prototype.outports = {};
    this.prototype.groups = [];
  }

  // ## Creating new graphs
  //
  // Graphs are created by simply instantiating the Graph class
  // and giving it a name:
  //
  //     myGraph = new Graph 'My very cool graph'
  constructor(name, options) {
    if (name == null) { name = ''; }
    if (options == null) { options = {}; }
    super();
    this.setMaxListeners(0);
    this.name = name;
    this.properties = {};
    this.nodes = [];
    this.edges = [];
    this.initializers = [];
    this.inports = {};
    this.outports = {};
    this.groups = [];
    this.transaction = {
      id: null,
      depth: 0
    };

    this.caseSensitive = options.caseSensitive || false;
  }

  getPortName(port) {
    if (this.caseSensitive) { return port; } else { return port.toLowerCase(); }
  }

  // ## Group graph changes into transactions
  //
  // If no transaction is explicitly opened, each call to
  // the graph API will implicitly create a transaction for that change
  startTransaction(id, metadata) {
    if (this.transaction.id) {
      throw Error("Nested transactions not supported");
    }

    this.transaction.id = id;
    this.transaction.depth = 1;
    return this.emit('startTransaction', id, metadata);
  }

  endTransaction(id, metadata) {
    if (!this.transaction.id) {
      throw Error("Attempted to end non-existing transaction");
    }

    this.transaction.id = null;
    this.transaction.depth = 0;
    return this.emit('endTransaction', id, metadata);
  }

  checkTransactionStart() {
    if (!this.transaction.id) {
      return this.startTransaction('implicit');
    } else if (this.transaction.id === 'implicit') {
      return this.transaction.depth += 1;
    }
  }

  checkTransactionEnd() {
    if (this.transaction.id === 'implicit') {
      this.transaction.depth -= 1;
    }
    if (this.transaction.depth === 0) {
      return this.endTransaction('implicit');
    }
  }

  // ## Modifying Graph properties
  //
  // This method allows changing properties of the graph.
  setProperties(properties) {
    this.checkTransactionStart();
    const before = clone(this.properties);
    for (let item in properties) {
      const val = properties[item];
      this.properties[item] = val;
    }
    this.emit('changeProperties', this.properties, before);
    return this.checkTransactionEnd();
  }

  addInport(publicPort, nodeKey, portKey, metadata) {
    // Check that node exists
    if (!this.getNode(nodeKey)) { return; }

    publicPort = this.getPortName(publicPort);
    this.checkTransactionStart();
    this.inports[publicPort] = {
      process: nodeKey,
      port: this.getPortName(portKey),
      metadata
    };
    this.emit('addInport', publicPort, this.inports[publicPort]);
    return this.checkTransactionEnd();
  }

  removeInport(publicPort) {
    publicPort = this.getPortName(publicPort);
    if (!this.inports[publicPort]) { return; }

    this.checkTransactionStart();
    const port = this.inports[publicPort];
    this.setInportMetadata(publicPort, {});
    delete this.inports[publicPort];
    this.emit('removeInport', publicPort, port);
    return this.checkTransactionEnd();
  }

  renameInport(oldPort, newPort) {
    oldPort = this.getPortName(oldPort);
    newPort = this.getPortName(newPort);
    if (!this.inports[oldPort]) { return; }
    if (newPort === oldPort) { return; }

    this.checkTransactionStart();
    this.inports[newPort] = this.inports[oldPort];
    delete this.inports[oldPort];
    this.emit('renameInport', oldPort, newPort);
    return this.checkTransactionEnd();
  }

  setInportMetadata(publicPort, metadata) {
    publicPort = this.getPortName(publicPort);
    if (!this.inports[publicPort]) { return; }

    this.checkTransactionStart();
    const before = clone(this.inports[publicPort].metadata);
    if (!this.inports[publicPort].metadata) { this.inports[publicPort].metadata = {}; }
    for (let item in metadata) {
      const val = metadata[item];
      if (val != null) {
        this.inports[publicPort].metadata[item] = val;
      } else {
        delete this.inports[publicPort].metadata[item];
      }
    }
    this.emit('changeInport', publicPort, this.inports[publicPort], before, metadata);
    return this.checkTransactionEnd();
  }

  addOutport(publicPort, nodeKey, portKey, metadata) {
    // Check that node exists
    if (!this.getNode(nodeKey)) { return; }

    publicPort = this.getPortName(publicPort);
    this.checkTransactionStart();
    this.outports[publicPort] = {
      process: nodeKey,
      port: this.getPortName(portKey),
      metadata
    };
    this.emit('addOutport', publicPort, this.outports[publicPort]);

    return this.checkTransactionEnd();
  }

  removeOutport(publicPort) {
    publicPort = this.getPortName(publicPort);
    if (!this.outports[publicPort]) { return; }

    this.checkTransactionStart();

    const port = this.outports[publicPort];
    this.setOutportMetadata(publicPort, {});
    delete this.outports[publicPort];
    this.emit('removeOutport', publicPort, port);

    return this.checkTransactionEnd();
  }

  renameOutport(oldPort, newPort) {
    oldPort = this.getPortName(oldPort);
    newPort = this.getPortName(newPort);
    if (!this.outports[oldPort]) { return; }

    this.checkTransactionStart();
    this.outports[newPort] = this.outports[oldPort];
    delete this.outports[oldPort];
    this.emit('renameOutport', oldPort, newPort);
    return this.checkTransactionEnd();
  }

  setOutportMetadata(publicPort, metadata) {
    publicPort = this.getPortName(publicPort);
    if (!this.outports[publicPort]) { return; }

    this.checkTransactionStart();
    const before = clone(this.outports[publicPort].metadata);
    if (!this.outports[publicPort].metadata) { this.outports[publicPort].metadata = {}; }
    for (let item in metadata) {
      const val = metadata[item];
      if (val != null) {
        this.outports[publicPort].metadata[item] = val;
      } else {
        delete this.outports[publicPort].metadata[item];
      }
    }
    this.emit('changeOutport', publicPort, this.outports[publicPort], before, metadata);
    return this.checkTransactionEnd();
  }

  // ## Grouping nodes in a graph
  //
  addGroup(group, nodes, metadata) {
    this.checkTransactionStart();

    const g = {
      name: group,
      nodes,
      metadata
    };
    this.groups.push(g);
    this.emit('addGroup', g);

    return this.checkTransactionEnd();
  }

  renameGroup(oldName, newName) {
    this.checkTransactionStart();
    for (let group of Array.from(this.groups)) {
      if (!group) { continue; }
      if (group.name !== oldName) { continue; }
      group.name = newName;
      this.emit('renameGroup', oldName, newName);
    }
    return this.checkTransactionEnd();
  }

  removeGroup(groupName) {
    this.checkTransactionStart();

    for (let group of Array.from(this.groups)) {
      if (!group) { continue; }
      if (group.name !== groupName) { continue; }
      this.setGroupMetadata(group.name, {});
      this.groups.splice(this.groups.indexOf(group), 1);
      this.emit('removeGroup', group);
    }

    return this.checkTransactionEnd();
  }

  setGroupMetadata(groupName, metadata) {
    this.checkTransactionStart();
    for (let group of Array.from(this.groups)) {
      if (!group) { continue; }
      if (group.name !== groupName) { continue; }
      const before = clone(group.metadata);
      for (let item in metadata) {
        const val = metadata[item];
        if (val != null) {
          group.metadata[item] = val;
        } else {
          delete group.metadata[item];
        }
      }
      this.emit('changeGroup', group, before, metadata);
    }
    return this.checkTransactionEnd();
  }

  // ## Adding a node to the graph
  //
  // Nodes are identified by an ID unique to the graph. Additionally,
  // a node may contain information on what FBP component it is and
  // possible display coordinates.
  //
  // For example:
  //
  //     myGraph.addNode 'Read, 'ReadFile',
  //       x: 91
  //       y: 154
  //
  // Addition of a node will emit the `addNode` event.
  addNode(id, component, metadata) {
    this.checkTransactionStart();

    if (!metadata) { metadata = {}; }
    const node = {
      id,
      component,
      metadata
    };
    this.nodes.push(node);
    this.emit('addNode', node);

    this.checkTransactionEnd();
    return node;
  }

  // ## Removing a node from the graph
  //
  // Existing nodes can be removed from a graph by their ID. This
  // will remove the node and also remove all edges connected to it.
  //
  //     myGraph.removeNode 'Read'
  //
  // Once the node has been removed, the `removeNode` event will be
  // emitted.
  removeNode(id) {
    let edge, initializer, priv, pub;
    const node = this.getNode(id);
    if (!node) { return; }

    this.checkTransactionStart();

    let toRemove = [];
    for (edge of Array.from(this.edges)) {
      if ((edge.from.node === node.id) || (edge.to.node === node.id)) {
        toRemove.push(edge);
      }
    }
    for (edge of Array.from(toRemove)) {
      this.removeEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port);
    }

    toRemove = [];
    for (initializer of Array.from(this.initializers)) {
      if (initializer.to.node === node.id) {
        toRemove.push(initializer);
      }
    }
    for (initializer of Array.from(toRemove)) {
      this.removeInitial(initializer.to.node, initializer.to.port);
    }

    toRemove = [];
    for (pub in this.inports) {
      priv = this.inports[pub];
      if (priv.process === id) {
        toRemove.push(pub);
      }
    }
    for (pub of Array.from(toRemove)) {
      this.removeInport(pub);
    }

    toRemove = [];
    for (pub in this.outports) {
      priv = this.outports[pub];
      if (priv.process === id) {
        toRemove.push(pub);
      }
    }
    for (pub of Array.from(toRemove)) {
      this.removeOutport(pub);
    }

    for (let group of Array.from(this.groups)) {
      if (!group) { continue; }
      const index = group.nodes.indexOf(id);
      if (index === -1) { continue; }
      group.nodes.splice(index, 1);
    }

    this.setNodeMetadata(id, {});

    if (-1 !== this.nodes.indexOf(node)) {
      this.nodes.splice(this.nodes.indexOf(node), 1);
    }

    this.emit('removeNode', node);

    return this.checkTransactionEnd();
  }

  // ## Getting a node
  //
  // Nodes objects can be retrieved from the graph by their ID:
  //
  //     myNode = myGraph.getNode 'Read'
  getNode(id) {
    for (let node of Array.from(this.nodes)) {
      if (!node) { continue; }
      if (node.id === id) { return node; }
    }
    return null;
  }

  // ## Renaming a node
  //
  // Nodes IDs can be changed by calling this method.
  renameNode(oldId, newId) {
    let priv, pub;
    this.checkTransactionStart();

    const node = this.getNode(oldId);
    if (!node) { return; }
    node.id = newId;

    for (let edge of Array.from(this.edges)) {
      if (!edge) { continue; }
      if (edge.from.node === oldId) {
        edge.from.node = newId;
      }
      if (edge.to.node === oldId) {
        edge.to.node = newId;
      }
    }

    for (let iip of Array.from(this.initializers)) {
      if (!iip) { continue; }
      if (iip.to.node === oldId) {
        iip.to.node = newId;
      }
    }

    for (pub in this.inports) {
      priv = this.inports[pub];
      if (priv.process === oldId) {
        priv.process = newId;
      }
    }
    for (pub in this.outports) {
      priv = this.outports[pub];
      if (priv.process === oldId) {
        priv.process = newId;
      }
    }

    for (let group of Array.from(this.groups)) {
      if (!group) { continue; }
      const index = group.nodes.indexOf(oldId);
      if (index === -1) { continue; }
      group.nodes[index] = newId;
    }

    this.emit('renameNode', oldId, newId);
    return this.checkTransactionEnd();
  }

  // ## Changing a node's metadata
  //
  // Node metadata can be set or changed by calling this method.
  setNodeMetadata(id, metadata) {
    const node = this.getNode(id);
    if (!node) { return; }

    this.checkTransactionStart();

    const before = clone(node.metadata);
    if (!node.metadata) { node.metadata = {}; }

    for (let item in metadata) {
      const val = metadata[item];
      if (val != null) {
        node.metadata[item] = val;
      } else {
        delete node.metadata[item];
      }
    }

    this.emit('changeNode', node, before, metadata);
    return this.checkTransactionEnd();
  }

  // ## Connecting nodes
  //
  // Nodes can be connected by adding edges between a node's outport
  // and another node's inport:
  //
  //     myGraph.addEdge 'Read', 'out', 'Display', 'in'
  //     myGraph.addEdgeIndex 'Read', 'out', null, 'Display', 'in', 2
  //
  // Adding an edge will emit the `addEdge` event.
  addEdge(outNode, outPort, inNode, inPort, metadata) {
    let edge;
    if (metadata == null) { metadata = {}; }
    outPort = this.getPortName(outPort);
    inPort = this.getPortName(inPort);
    for (edge of Array.from(this.edges)) {
      // don't add a duplicate edge
      if ((edge.from.node === outNode) && (edge.from.port === outPort) && (edge.to.node === inNode) && (edge.to.port === inPort)) { return; }
    }
    if (!this.getNode(outNode)) { return; }
    if (!this.getNode(inNode)) { return; }

    this.checkTransactionStart();

    edge = {
      from: {
        node: outNode,
        port: outPort
      },
      to: {
        node: inNode,
        port: inPort
      },
      metadata
    };
    this.edges.push(edge);
    this.emit('addEdge', edge);

    this.checkTransactionEnd();
    return edge;
  }

  // Adding an edge will emit the `addEdge` event.
  addEdgeIndex(outNode, outPort, outIndex, inNode, inPort, inIndex, metadata) {
    if (metadata == null) { metadata = {}; }
    if (!this.getNode(outNode)) { return; }
    if (!this.getNode(inNode)) { return; }

    outPort = this.getPortName(outPort);
    inPort = this.getPortName(inPort);

    if (inIndex === null) { inIndex = undefined; }
    if (outIndex === null) { outIndex = undefined; }
    if (!metadata) { metadata = {}; }

    this.checkTransactionStart();

    const edge = {
      from: {
        node: outNode,
        port: outPort,
        index: outIndex
      },
      to: {
        node: inNode,
        port: inPort,
        index: inIndex
      },
      metadata
    };
    this.edges.push(edge);
    this.emit('addEdge', edge);

    this.checkTransactionEnd();
    return edge;
  }

  // ## Disconnected nodes
  //
  // Connections between nodes can be removed by providing the
  // nodes and ports to disconnect.
  //
  //     myGraph.removeEdge 'Display', 'out', 'Foo', 'in'
  //
  // Removing a connection will emit the `removeEdge` event.
  removeEdge(node, port, node2, port2) {
    let edge, index;
    this.checkTransactionStart();
    port = this.getPortName(port);
    port2 = this.getPortName(port2);
    const toRemove = [];
    const toKeep = [];
    if (node2 && port2) {
      for (index = 0; index < this.edges.length; index++) {
        edge = this.edges[index];
        if ((edge.from.node === node) && (edge.from.port === port) && (edge.to.node === node2) && (edge.to.port === port2)) {
          this.setEdgeMetadata(edge.from.node, edge.from.port, edge.to.node, edge.to.port, {});
          toRemove.push(edge);
        } else {
          toKeep.push(edge);
        }
      }
    } else {
      for (index = 0; index < this.edges.length; index++) {
        edge = this.edges[index];
        if (((edge.from.node === node) && (edge.from.port === port)) || ((edge.to.node === node) && (edge.to.port === port))) {
          this.setEdgeMetadata(edge.from.node, edge.from.port, edge.to.node, edge.to.port, {});
          toRemove.push(edge);
        } else {
          toKeep.push(edge);
        }
      }
    }

    this.edges = toKeep;
    for (edge of Array.from(toRemove)) {
      this.emit('removeEdge', edge);
    }

    return this.checkTransactionEnd();
  }

  // ## Getting an edge
  //
  // Edge objects can be retrieved from the graph by the node and port IDs:
  //
  //     myEdge = myGraph.getEdge 'Read', 'out', 'Write', 'in'
  getEdge(node, port, node2, port2) {
    port = this.getPortName(port);
    port2 = this.getPortName(port2);
    for (let index = 0; index < this.edges.length; index++) {
      const edge = this.edges[index];
      if (!edge) { continue; }
      if ((edge.from.node === node) && (edge.from.port === port)) {
        if ((edge.to.node === node2) && (edge.to.port === port2)) {
          return edge;
        }
      }
    }
    return null;
  }

  // ## Changing an edge's metadata
  //
  // Edge metadata can be set or changed by calling this method.
  setEdgeMetadata(node, port, node2, port2, metadata) {
    const edge = this.getEdge(node, port, node2, port2);
    if (!edge) { return; }

    this.checkTransactionStart();
    const before = clone(edge.metadata);
    if (!edge.metadata) { edge.metadata = {}; }

    for (let item in metadata) {
      const val = metadata[item];
      if (val != null) {
        edge.metadata[item] = val;
      } else {
        delete edge.metadata[item];
      }
    }

    this.emit('changeEdge', edge, before, metadata);
    return this.checkTransactionEnd();
  }

  // ## Adding Initial Information Packets
  //
  // Initial Information Packets (IIPs) can be used for sending data
  // to specified node inports without a sending node instance.
  //
  // IIPs are especially useful for sending configuration information
  // to components at FBP network start-up time. This could include
  // filenames to read, or network ports to listen to.
  //
  //     myGraph.addInitial 'somefile.txt', 'Read', 'source'
  //     myGraph.addInitialIndex 'somefile.txt', 'Read', 'source', 2
  //
  // If inports are defined on the graph, IIPs can be applied calling
  // the `addGraphInitial` or `addGraphInitialIndex` methods.
  //
  //     myGraph.addGraphInitial 'somefile.txt', 'file'
  //     myGraph.addGraphInitialIndex 'somefile.txt', 'file', 2
  //
  // Adding an IIP will emit a `addInitial` event.
  addInitial(data, node, port, metadata) {
    if (!this.getNode(node)) { return; }

    port = this.getPortName(port);
    this.checkTransactionStart();
    const initializer = {
      from: {
        data
      },
      to: {
        node,
        port
      },
      metadata
    };
    this.initializers.push(initializer);
    this.emit('addInitial', initializer);

    this.checkTransactionEnd();
    return initializer;
  }

  addInitialIndex(data, node, port, index, metadata) {
    if (!this.getNode(node)) { return; }
    if (index === null) { index = undefined; }

    port = this.getPortName(port);
    this.checkTransactionStart();
    const initializer = {
      from: {
        data
      },
      to: {
        node,
        port,
        index
      },
      metadata
    };
    this.initializers.push(initializer);
    this.emit('addInitial', initializer);

    this.checkTransactionEnd();
    return initializer;
  }

  addGraphInitial(data, node, metadata) {
    const inport = this.inports[node];
    if (!inport) { return; }
    return this.addInitial(data, inport.process, inport.port, metadata);
  }

  addGraphInitialIndex(data, node, index, metadata) {
    const inport = this.inports[node];
    if (!inport) { return; }
    return this.addInitialIndex(data, inport.process, inport.port, index, metadata);
  }

  // ## Removing Initial Information Packets
  //
  // IIPs can be removed by calling the `removeInitial` method.
  //
  //     myGraph.removeInitial 'Read', 'source'
  //
  // If the IIP was applied via the `addGraphInitial` or
  // `addGraphInitialIndex` functions, it can be removed using
  // the `removeGraphInitial` method.
  //
  //     myGraph.removeGraphInitial 'file'
  //
  // Remove an IIP will emit a `removeInitial` event.
  removeInitial(node, port) {
    let edge;
    port = this.getPortName(port);
    this.checkTransactionStart();

    const toRemove = [];
    const toKeep = [];
    for (let index = 0; index < this.initializers.length; index++) {
      edge = this.initializers[index];
      if ((edge.to.node === node) && (edge.to.port === port)) {
        toRemove.push(edge);
      } else {
        toKeep.push(edge);
      }
    }
    this.initializers = toKeep;
    for (edge of Array.from(toRemove)) {
      this.emit('removeInitial', edge);
    }

    return this.checkTransactionEnd();
  }

  removeGraphInitial(node) {
    const inport = this.inports[node];
    if (!inport) { return; }
    return this.removeInitial(inport.process, inport.port);
  }

  toDOT() {
    let node;
    const wrapQuotes = id => `\"${id.replace(/"/g, '\\"')}\"`;
    const cleanPort = port => port.replace(/\./g, "");

    let dot = "digraph {\n";

    for (node of Array.from(this.nodes)) {
      dot += `    ${wrapQuotes(node.id)} [label=${wrapQuotes(node.id)} shape=box]\n`;
    }

    for (let id = 0; id < this.initializers.length; id++) {
      var data;
      const initializer = this.initializers[id];
      if (typeof initializer.from.data === 'function') {
        data = 'Function';
      } else {
        data = JSON.stringify(initializer.from.data);
      }
      dot += `    data${id} [label=${wrapQuotes(data)} shape=plaintext]\n`;
      dot += `    data${id} -> ${wrapQuotes(initializer.to.node)}[headlabel=${cleanPort(initializer.to.port)} labelfontcolor=blue labelfontsize=8.0]\n`;
    }

    for (let edge of Array.from(this.edges)) {
      dot += `    ${wrapQuotes(edge.from.node)} -> ${wrapQuotes(edge.to.node)}[taillabel=${cleanPort(edge.from.port)} headlabel=${cleanPort(edge.to.port)} labelfontcolor=blue labelfontsize=8.0]\n`;
    }

    dot += "}";

    return dot;
  }

  toYUML() {
    const yuml = [];

    for (let initializer of Array.from(this.initializers)) {
      yuml.push(`(start)[${initializer.to.port}]->(${initializer.to.node})`);
    }

    for (let edge of Array.from(this.edges)) {
      yuml.push(`(${edge.from.node})[${edge.from.port}]->(${edge.to.node})`);
    }
    return yuml.join(",");
  }

  toJSON() {
    let node, priv, pub;
    const json = {
      caseSensitive: this.caseSensitive,
      properties: {},
      inports: {},
      outports: {},
      groups: [],
      processes: {},
      connections: []
    };

    if (this.name) { json.properties.name = this.name; }
    for (let property in this.properties) {
      const value = this.properties[property];
      json.properties[property] = value;
    }

    for (pub in this.inports) {
      priv = this.inports[pub];
      json.inports[pub] = priv;
    }
    for (pub in this.outports) {
      priv = this.outports[pub];
      json.outports[pub] = priv;
    }

    for (let group of Array.from(this.groups)) {
      const groupData = {
        name: group.name,
        nodes: group.nodes
      };
      if (Object.keys(group.metadata).length) {
        groupData.metadata = group.metadata;
      }
      json.groups.push(groupData);
    }

    for (node of Array.from(this.nodes)) {
      json.processes[node.id] =
        {component: node.component};
      if (node.metadata) {
        json.processes[node.id].metadata = node.metadata;
      }
    }

    for (let edge of Array.from(this.edges)) {
      const connection = {
        src: {
          process: edge.from.node,
          port: edge.from.port,
          index: edge.from.index
        },
        tgt: {
          process: edge.to.node,
          port: edge.to.port,
          index: edge.to.index
        }
      };
      if (Object.keys(edge.metadata).length) { connection.metadata = edge.metadata; }
      json.connections.push(connection);
    }

    for (let initializer of Array.from(this.initializers)) {
      json.connections.push({
        data: initializer.from.data,
        tgt: {
          process: initializer.to.node,
          port: initializer.to.port,
          index: initializer.to.index
        }
      });
    }

    return json;
  }

  save(file, callback) {
    if (platform.isBrowser()) {
      return callback(new Error("Saving graphs not supported on browser"));
    }

    const json = JSON.stringify(this.toJSON(), null, 4);
    if (!file.match(/\.json$/)) {
      file = `${file}.json`;
    }
    return require('fs').writeFile(file, json, "utf-8", function(err, data) {
      if (err) { return callback(err); }
      return callback(null, file);
    });
  }
}
Graph.initClass();

exports.Graph = Graph;

exports.createGraph = (name, options) => new Graph(name, options);

exports.loadJSON = function(passedDefinition, callback, metadata) {
  let definition, priv, pub;
  if (metadata == null) { metadata = {}; }
  if (typeof passedDefinition === 'string') {
    definition = JSON.parse(passedDefinition);
  } else {
    definition = JSON.parse(JSON.stringify(passedDefinition));
  }

  if (!definition.properties) { definition.properties = {}; }
  if (!definition.processes) { definition.processes = {}; }
  if (!definition.connections) { definition.connections = []; }
  const caseSensitive = definition.caseSensitive || false;

  const graph = new Graph(definition.properties.name, {caseSensitive});

  graph.startTransaction('loadJSON', metadata);
  const properties = {};
  for (let property in definition.properties) {
    const value = definition.properties[property];
    if (property === 'name') { continue; }
    properties[property] = value;
  }
  graph.setProperties(properties);

  for (let id in definition.processes) {
    const def = definition.processes[id];
    if (!def.metadata) { def.metadata = {}; }
    graph.addNode(id, def.component, def.metadata);
  }

  for (let conn of Array.from(definition.connections)) {
    metadata = conn.metadata ? conn.metadata : {};
    if (conn.data !== undefined) {
      if (typeof conn.tgt.index === 'number') {
        graph.addInitialIndex(conn.data, conn.tgt.process, graph.getPortName(conn.tgt.port), conn.tgt.index, metadata);
      } else {
        graph.addInitial(conn.data, conn.tgt.process, graph.getPortName(conn.tgt.port), metadata);
      }
      continue;
    }
    if ((typeof conn.src.index === 'number') || (typeof conn.tgt.index === 'number')) {
      graph.addEdgeIndex(conn.src.process, graph.getPortName(conn.src.port), conn.src.index, conn.tgt.process, graph.getPortName(conn.tgt.port), conn.tgt.index, metadata);
      continue;
    }
    graph.addEdge(conn.src.process, graph.getPortName(conn.src.port), conn.tgt.process, graph.getPortName(conn.tgt.port), metadata);
  }

  if (definition.inports) {
    for (pub in definition.inports) {
      priv = definition.inports[pub];
      graph.addInport(pub, priv.process, graph.getPortName(priv.port), priv.metadata);
    }
  }
  if (definition.outports) {
    for (pub in definition.outports) {
      priv = definition.outports[pub];
      graph.addOutport(pub, priv.process, graph.getPortName(priv.port), priv.metadata);
    }
  }

  if (definition.groups) {
    for (let group of Array.from(definition.groups)) {
      graph.addGroup(group.name, group.nodes, group.metadata || {});
    }
  }

  graph.endTransaction('loadJSON');

  return callback(null, graph);
};

exports.loadFBP = function(fbpData, callback, metadata, caseSensitive) {
  let definition;
  if (metadata == null) { metadata = {}; }
  if (caseSensitive == null) { caseSensitive = false; }
  try {
    definition = require('fbp').parse(fbpData, {caseSensitive});
  } catch (e) {
    return callback(e);
  }
  return exports.loadJSON(definition, callback, metadata);
};

exports.loadHTTP = function(url, callback) {
  const req = new XMLHttpRequest;
  req.onreadystatechange = function() {
    if (req.readyState !== 4) { return; }
    if (req.status !== 200) {
      return callback(new Error(`Failed to load ${url}: HTTP ${req.status}`));
    }
    return callback(null, req.responseText);
  };
  req.open('GET', url, true);
  return req.send();
};

exports.loadFile = function(file, callback, metadata, caseSensitive) {
  if (metadata == null) { metadata = {}; }
  if (caseSensitive == null) { caseSensitive = false; }
  if (platform.isBrowser()) {
    // On browser we can try getting the file via AJAX
    exports.loadHTTP(file, function(err, data) {
      if (err) { return callback(err); }
      if (file.split('.').pop() === 'fbp') {
        return exports.loadFBP(data, callback, metadata);
      }
      const definition = JSON.parse(data);
      return exports.loadJSON(definition, callback, metadata);
    });
    return;
  }
  // Node.js graph file
  return require('fs').readFile(file, "utf-8", function(err, data) {
    if (err) { return callback(err); }

    if (file.split('.').pop() === 'fbp') {
      return exports.loadFBP(data, callback, {}, caseSensitive);
    }

    const definition = JSON.parse(data);
    return exports.loadJSON(definition, callback, {});
});
};

// remove everything in the graph
const resetGraph = function(graph) {

  // Edges and similar first, to have control over the order
  // If we'd do nodes first, it will implicitly delete edges
  // Important to make journal transactions invertible
  let port, v;
  for (let group of Array.from((clone(graph.groups)).reverse())) {
    if (group != null) { graph.removeGroup(group.name); }
  }
  const object = clone(graph.outports);
  for (port in object) {
    v = object[port];
    graph.removeOutport(port);
  }
  const object1 = clone(graph.inports);
  for (port in object1) {
    v = object1[port];
    graph.removeInport(port);
  }
  // XXX: does this actually null the props??
  graph.setProperties({});
  for (let iip of Array.from((clone(graph.initializers)).reverse())) {
    graph.removeInitial(iip.to.node, iip.to.port);
  }
  for (let edge of Array.from((clone(graph.edges)).reverse())) {
    graph.removeEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port);
  }
  return Array.from((clone(graph.nodes)).reverse()).map((node) =>
    graph.removeNode(node.id));
};

// Note: Caller should create transaction
// First removes everything in @base, before building it up to mirror @to
const mergeResolveTheirsNaive = function(base, to) {
  let node, priv, pub;
  resetGraph(base);

  for (node of Array.from(to.nodes)) {
    base.addNode(node.id, node.component, node.metadata);
  }
  for (let edge of Array.from(to.edges)) {
    base.addEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port, edge.metadata);
  }
  for (let iip of Array.from(to.initializers)) {
    base.addInitial(iip.from.data, iip.to.node, iip.to.port, iip.metadata);
  }
  base.setProperties(to.properties);
  for (pub in to.inports) {
    priv = to.inports[pub];
    base.addInport(pub, priv.process, priv.port, priv.metadata);
  }
  for (pub in to.outports) {
    priv = to.outports[pub];
    base.addOutport(pub, priv.process, priv.port, priv.metadata);
  }
  return Array.from(to.groups).map((group) =>
    base.addGroup(group.name, group.nodes, group.metadata));
};

exports.equivalent = function(a, b, options) {
  // TODO: add option to only compare known fields
  // TODO: add option to ignore metadata
  if (options == null) { options = {}; }
  const A = JSON.stringify(a);
  const B = JSON.stringify(b);
  return A === B;
};

exports.mergeResolveTheirs = mergeResolveTheirsNaive;
