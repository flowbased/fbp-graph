//     FBP Graph
//     (c) 2013-2017 Flowhub UG
//     (c) 2011-2012 Henri Bergius, Nemein
//     FBP Graph may be freely distributed under the MIT license
//
// FBP graphs are Event Emitters, providing signals when the graph
// definition changes.
/* eslint-env browser, node */
import { EventEmitter } from 'events';
import * as clone from 'clone';
import { isBrowser } from './Platform';
import {
  JournalMetadata,
  GraphOptions,
  PropertyMap,
  GraphNode,
  GraphNodeMetadata,
  GraphNodeID,
  GraphEdge,
  GraphEdgeMetadata,
  GraphJsonEdge,
  GraphIIP,
  GraphIIPMetadata,
  GraphExportedPort,
  GraphGroup,
  GraphGroupMetadata,
  GraphJson,
} from './Types';

// This class represents an abstract FBP graph containing nodes
// connected to each other with edges.
//
// These graphs can be used for visualization and sketching, but
// also are the way to start a NoFlo or other FBP network.
class Graph extends EventEmitter {
  // ## Creating new graphs
  //
  // Graphs are created by simply instantiating the Graph class
  // and giving it a name:
  //
  //     myGraph = new Graph 'My very cool graph'
  name: string;
  properties: PropertyMap;
  nodes: Array<GraphNode>;
  edges: Array<GraphEdge>;
  initializers: Array<GraphIIP>;
  inports: {
    [key: string]: GraphExportedPort,
  };
  outports: {
    [key: string]: GraphExportedPort,
  };
  groups: Array<GraphGroup>;
  transaction: {
    id: string | null,
    depth: number,
  };
  caseSensitive: boolean;
  constructor(name: string = '', options: GraphOptions = {}) {
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
      depth: 0,
    };

    this.caseSensitive = options.caseSensitive || false;
  }

  getPortName(port: string = ''): string {
    if (this.caseSensitive) {
      return port;
    }
    return port.toLowerCase();
  }

  // ## Group graph changes into transactions
  //
  // If no transaction is explicitly opened, each call to
  // the graph API will implicitly create a transaction for that change
  startTransaction(id: string, metadata: JournalMetadata = {}) {
    if (this.transaction.id) {
      throw Error('Nested transactions not supported');
    }

    this.transaction.id = id;
    this.transaction.depth = 1;
    this.emit('startTransaction', id, metadata);
  }

  endTransaction(id: string, metadata: JournalMetadata = {}) {
    if (!this.transaction.id) {
      throw Error('Attempted to end non-existing transaction');
    }

    this.transaction.id = null;
    this.transaction.depth = 0;
    this.emit('endTransaction', id, metadata);
  }

  checkTransactionStart() {
    if (!this.transaction.id) {
      this.startTransaction('implicit');
    } else if (this.transaction.id === 'implicit') {
      this.transaction.depth += 1;
    }
  }

  checkTransactionEnd() {
    if (this.transaction.id === 'implicit') {
      this.transaction.depth -= 1;
    }
    if (this.transaction.depth === 0) {
      this.endTransaction('implicit');
    }
  }

  // ## Modifying Graph properties
  //
  // This method allows changing properties of the graph.
  setProperties(properties: PropertyMap) {
    this.checkTransactionStart();
    const before = clone(this.properties);
    Object.keys(properties).forEach((item) => {
      const val = properties[item];
      this.properties[item] = val;
    });
    this.emit('changeProperties', this.properties, before);
    this.checkTransactionEnd();
  }

  addInport(publicPort: string, nodeKey: GraphNodeID, portKey: string, metadata: GraphNodeMetadata) {
    // Check that node exists
    if (!this.getNode(nodeKey)) { return; }

    const portName = this.getPortName(publicPort);
    this.checkTransactionStart();
    this.inports[portName] = {
      process: nodeKey,
      port: this.getPortName(portKey),
      metadata,
    };
    this.emit('addInport', portName, this.inports[portName]);
    this.checkTransactionEnd();
  }

  removeInport(publicPort: string) {
    const portName = this.getPortName(publicPort);
    if (!this.inports[portName]) { return; }

    this.checkTransactionStart();
    const port = this.inports[portName];
    this.setInportMetadata(portName, {});
    delete this.inports[portName];
    this.emit('removeInport', portName, port);
    this.checkTransactionEnd();
  }

  renameInport(oldPort: string, newPort: string) {
    const oldPortName = this.getPortName(oldPort);
    const newPortName = this.getPortName(newPort);
    if (!this.inports[oldPortName]) { return; }
    if (newPortName === oldPortName) { return; }

    this.checkTransactionStart();
    this.inports[newPortName] = this.inports[oldPortName];
    delete this.inports[oldPortName];
    this.emit('renameInport', oldPortName, newPortName);
    this.checkTransactionEnd();
  }

  setInportMetadata(publicPort:string, metadata: GraphNodeMetadata) {
    const portName = this.getPortName(publicPort);
    if (!this.inports[portName]) { return; }

    this.checkTransactionStart();
    if (!this.inports[portName].metadata) {
      this.inports[portName].metadata = {};
    }
    const before = clone(this.inports[portName].metadata);
    Object.keys(metadata).forEach((item) => {
      const val = metadata[item];
      const existingMeta = this.inports[portName].metadata;
      if (!existingMeta) {
        return;
      }
      if (val != null) {
        existingMeta[item] = val;
      } else {
        delete existingMeta[item];
      }
    });
    this.emit('changeInport', portName, this.inports[portName], before, metadata);
    this.checkTransactionEnd();
  }

  addOutport(publicPort: string, nodeKey: GraphNodeID, portKey: string, metadata: GraphNodeMetadata) {
    // Check that node exists
    if (!this.getNode(nodeKey)) { return; }

    const portName = this.getPortName(publicPort);
    this.checkTransactionStart();
    this.outports[portName] = {
      process: nodeKey,
      port: this.getPortName(portKey),
      metadata,
    };
    this.emit('addOutport', portName, this.outports[portName]);

    this.checkTransactionEnd();
  }

  removeOutport(publicPort: string) {
    const portName = this.getPortName(publicPort);
    if (!this.outports[portName]) { return; }

    this.checkTransactionStart();

    const port = this.outports[portName];
    this.setOutportMetadata(portName, {});
    delete this.outports[portName];
    this.emit('removeOutport', portName, port);

    this.checkTransactionEnd();
  }

  renameOutport(oldPort: string, newPort: string) {
    const oldPortName = this.getPortName(oldPort);
    const newPortName = this.getPortName(newPort);
    if (!this.outports[oldPortName]) { return; }

    this.checkTransactionStart();
    this.outports[newPortName] = this.outports[oldPortName];
    delete this.outports[oldPortName];
    this.emit('renameOutport', oldPortName, newPortName);
    this.checkTransactionEnd();
  }

  setOutportMetadata(publicPort: string, metadata: GraphNodeMetadata) {
    const portName = this.getPortName(publicPort);
    if (!this.outports[portName]) { return; }

    this.checkTransactionStart();
    const before = clone(this.outports[portName].metadata);
    if (!this.outports[portName].metadata) {
      this.outports[portName].metadata = {};
    }
    Object.keys(metadata).forEach((item) => {
      const val = metadata[item];
      const existingMeta = this.outports[portName].metadata;
      if (!existingMeta) {
        return;
      }
      if (val != null) {
        existingMeta[item] = val;
      } else {
        delete existingMeta[item];
      }
    });
    this.emit('changeOutport', portName, this.outports[portName], before, metadata);
    this.checkTransactionEnd();
  }

  // ## Grouping nodes in a graph
  //
  addGroup(group: string, nodes: Array<GraphNodeID>, metadata: GraphGroupMetadata): GraphGroup {
    this.checkTransactionStart();

    const g = {
      name: group,
      nodes,
      metadata,
    };
    this.groups.push(g);
    this.emit('addGroup', g);

    this.checkTransactionEnd();

    return g;
  }

  renameGroup(oldName: string, newName: string) {
    this.checkTransactionStart();
    this.groups.forEach((group) => {
      if (!group) { return; }
      if (group.name !== oldName) { return; }
      const g = group;
      g.name = newName;
      this.emit('renameGroup', oldName, newName);
    });
    this.checkTransactionEnd();
  }

  removeGroup(groupName: string) {
    this.checkTransactionStart();
    this.groups = this.groups.filter((group) => {
      if (!group) { return false; }
      if (group.name !== groupName) { return true; }
      this.setGroupMetadata(group.name, {});
      this.emit('removeGroup', group);
      return false;
    });
    this.checkTransactionEnd();
  }

  setGroupMetadata(groupName: string, metadata: GraphGroupMetadata) {
    this.checkTransactionStart();
    this.groups.forEach((group) => {
      if (!group) { return; }
      if (group.name !== groupName) { return; }
      const before = clone(group.metadata);
      Object.keys(metadata).forEach((item) => {
        const val = metadata[item];
        const g = group;
        if (!g.metadata) {
          return;
        }
        if (val != null) {
          g.metadata[item] = val;
        } else {
          delete g.metadata[item];
        }
      });
      this.emit('changeGroup', group, before, metadata);
    });
    this.checkTransactionEnd();
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
  addNode(id: GraphNodeID, component: string, metadata: GraphNodeMetadata = {}): GraphNode {
    this.checkTransactionStart();
    const node = {
      id,
      component,
      metadata,
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
  removeNode(id: GraphNodeID) {
    const node = this.getNode(id);
    if (!node) {
      return;
    }

    this.checkTransactionStart();

    this.edges.forEach((edge) => {
      if ((edge.from.node === node.id) || (edge.to.node === node.id)) {
        this.removeEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port);
      }
    });
    this.initializers.forEach((initializer) => {
      if (initializer.to.node === node.id) {
        this.removeInitial(initializer.to.node, initializer.to.port);
      }
    });
    Object.keys(this.inports).forEach((pub) => {
      const priv = this.inports[pub];
      if (priv.process === id) {
        this.removeInport(pub);
      }
    });
    Object.keys(this.outports).forEach((pub) => {
      const priv = this.outports[pub];
      if (priv.process === id) {
        this.removeOutport(pub);
      }
    });
    this.groups.forEach((group) => {
      if (!group) { return; }
      const index = group.nodes.indexOf(id);
      if (index === -1) {
        return;
      }
      group.nodes.splice(index, 1);
      if (group.nodes.length === 0) {
        // Don't leave empty groups behind
        this.removeGroup(group.name);
      }
    });

    this.setNodeMetadata(id, {});
    this.nodes = this.nodes.filter((n) => n !== node);
    this.emit('removeNode', node);

    this.checkTransactionEnd();
  }

  // ## Getting a node
  //
  // Nodes objects can be retrieved from the graph by their ID:
  //
  //     myNode = myGraph.getNode 'Read'
  getNode(id: GraphNodeID): GraphNode | null {
    const node = this.nodes.find((node) => node && node.id === id);
    if (!node) {
      return null;
    }
    return node;
  }

  // ## Renaming a node
  //
  // Nodes IDs can be changed by calling this method.
  renameNode(oldId: GraphNodeID, newId: GraphNodeID) {
    this.checkTransactionStart();

    const node = this.getNode(oldId);
    if (!node) { return; }
    node.id = newId;

    this.edges.forEach((e) => {
      const edge = e;
      if (!edge) { return; }
      if (edge.from.node === oldId) {
        edge.from.node = newId;
      }
      if (edge.to.node === oldId) {
        edge.to.node = newId;
      }
    });

    this.initializers.forEach((i) => {
      const iip = i;
      if (!iip) { return; }
      if (iip.to.node === oldId) {
        iip.to.node = newId;
      }
    });

    Object.keys(this.inports).forEach((pub) => {
      const priv = this.inports[pub];
      if (priv.process === oldId) {
        priv.process = newId;
      }
    });
    Object.keys(this.outports).forEach((pub) => {
      const priv = this.outports[pub];
      if (priv.process === oldId) {
        priv.process = newId;
      }
    });

    this.groups.forEach((group) => {
      if (!group) { return; }
      const index = group.nodes.indexOf(oldId);
      if (index === -1) { return; }
      const g = group;
      g.nodes[index] = newId;
    });

    this.emit('renameNode', oldId, newId);
    this.checkTransactionEnd();
  }

  // ## Changing a node's metadata
  //
  // Node metadata can be set or changed by calling this method.
  setNodeMetadata(id: GraphNodeID, metadata: GraphNodeMetadata) {
    const node = this.getNode(id);
    if (!node) { return; }

    this.checkTransactionStart();

    if (!node.metadata) {
      node.metadata = {};
    }
    const before = clone(node.metadata);

    Object.keys(metadata).forEach((item) => {
      if (!node.metadata) {
        return;
      }
      const val = metadata[item];
      if (val != null) {
        node.metadata[item] = val;
      } else {
        delete node.metadata[item];
      }
    });

    this.emit('changeNode', node, before, metadata);
    this.checkTransactionEnd();
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
  addEdge(outNode: GraphNodeID, outPort: string, inNode: GraphNodeID, inPort: string, metadata: GraphEdgeMetadata = {}): GraphEdge | null {
    const outPortName = this.getPortName(outPort);
    const inPortName = this.getPortName(inPort);
    if (this.edges.some((edge) => {
      // don't add a duplicate edge
      if ((edge.from.node === outNode)
        && (edge.from.port === outPortName)
        && (edge.to.node === inNode)
        && (edge.to.port === inPortName)) {
        return true;
      }
      return false;
    })) {
      return null;
    }
    if (!this.getNode(outNode)) {
      return null;
    }
    if (!this.getNode(inNode)) {
      return null;
    }

    this.checkTransactionStart();

    const edge = {
      from: {
        node: outNode,
        port: outPortName,
      },
      to: {
        node: inNode,
        port: inPortName,
      },
      metadata,
    };
    this.edges.push(edge);
    this.emit('addEdge', edge);

    this.checkTransactionEnd();
    return edge;
  }

  // Adding an edge will emit the `addEdge` event.
  addEdgeIndex(outNode: GraphNodeID, outPort: string, outIndex: number | undefined, inNode: GraphNodeID, inPort: string, inIndex: number | undefined, metadata: GraphEdgeMetadata = {}): GraphEdge | null {
    const outPortName = this.getPortName(outPort);
    const inPortName = this.getPortName(inPort);
    const inIndexVal = (inIndex === null) ? undefined : inIndex;
    const outIndexVal = (outIndex === null) ? undefined : outIndex;
    if (this.edges.some((edge) => {
      // don't add a duplicate edge
      if ((edge.from.node === outNode)
        && (edge.from.port === outPortName)
        && (edge.from.index === outIndexVal)
        && (edge.to.node === inNode)
        && (edge.to.port === inPortName)
        && (edge.to.index === inIndexVal)) {
        return true;
      }
      return false;
    })) {
      return null;
    }
    if (!this.getNode(outNode)) {
      return null;
    }
    if (!this.getNode(inNode)) {
      return null;
    }

    this.checkTransactionStart();

    const edge = {
      from: {
        node: outNode,
        port: outPortName,
        index: outIndexVal,
      },
      to: {
        node: inNode,
        port: inPortName,
        index: inIndexVal,
      },
      metadata,
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
  removeEdge(node: GraphNodeID, port: string, node2: GraphNodeID, port2: string) {
    if (!this.getEdge(node, port, node2, port2)) {
      return;
    }
    this.checkTransactionStart();
    const outPort = this.getPortName(port);
    const inPort = this.getPortName(port2);
    this.edges = this.edges.filter((edge) => {
      if (node2 && inPort) {
        if ((edge.from.node === node)
          && (edge.from.port === outPort)
          && (edge.to.node === node2)
          && (edge.to.port === inPort)) {
          this.setEdgeMetadata(edge.from.node, edge.from.port, edge.to.node, edge.to.port, {});
          this.emit('removeEdge', edge);
          return false;
        }
      } else if (((edge.from.node === node) && (edge.from.port === outPort))
        || ((edge.to.node === node) && (edge.to.port === outPort))) {
        this.setEdgeMetadata(edge.from.node, edge.from.port, edge.to.node, edge.to.port, {});
        this.emit('removeEdge', edge);
        return false;
      }
      return true;
    });

    this.checkTransactionEnd();
  }

  // ## Getting an edge
  //
  // Edge objects can be retrieved from the graph by the node and port IDs:
  //
  //     myEdge = myGraph.getEdge 'Read', 'out', 'Write', 'in'
  getEdge(node: GraphNodeID, port: string, node2: GraphNodeID, port2: string): GraphEdge | null {
    const outPort = this.getPortName(port);
    const inPort = this.getPortName(port2);
    const edge = this.edges.find((edge) => {
      if (!edge) {
        return false;
      }
      if (edge.from.node === node
        && edge.from.port === outPort
        && edge.to.node === node2
        && edge.to.port === inPort) {
        return true;
      }
      return false;
    });
    if (!edge) {
      return null;
    }
    return edge;
  }

  // ## Changing an edge's metadata
  //
  // Edge metadata can be set or changed by calling this method.
  setEdgeMetadata(node: GraphNodeID, port: string, node2: GraphNodeID, port2: string, metadata: GraphEdgeMetadata) {
    const edge = this.getEdge(node, port, node2, port2);
    if (!edge) { return; }

    this.checkTransactionStart();
    if (!edge.metadata) { edge.metadata = {}; }
    const before = clone(edge.metadata);

    Object.keys(metadata).forEach((item) => {
      const val = metadata[item];
      if (!edge.metadata) {
        edge.metadata = {};
      }
      if (val !== null) {
        edge.metadata[item] = val;
      } else {
        delete edge.metadata[item];
      }
    });

    this.emit('changeEdge', edge, before, metadata);
    this.checkTransactionEnd();
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
  addInitial(data: any, node: GraphNodeID, port: string, metadata: GraphIIPMetadata): GraphIIP | null {
    if (!this.getNode(node)) {
      return null;
    }
    const portName = this.getPortName(port);

    this.checkTransactionStart();
    const initializer = {
      from: {
        data,
      },
      to: {
        node,
        port: portName,
      },
      metadata,
    };
    this.initializers.push(initializer);
    this.emit('addInitial', initializer);

    this.checkTransactionEnd();
    return initializer;
  }

  addInitialIndex(data: any, node: GraphNodeID, port: string, index: number, metadata: GraphIIPMetadata): GraphIIP | null {
    if (!this.getNode(node)) { return null; }

    const indexVal = (index === null) ? undefined : index;
    const portName = this.getPortName(port);

    this.checkTransactionStart();
    const initializer = {
      from: {
        data,
      },
      to: {
        node,
        port: portName,
        index: indexVal,
      },
      metadata,
    };
    this.initializers.push(initializer);
    this.emit('addInitial', initializer);

    this.checkTransactionEnd();
    return initializer;
  }

  addGraphInitial(data: any, node: string, metadata: GraphIIPMetadata): GraphIIP | null {
    const inport = this.inports[node];
    if (!inport) { return null; }
    return this.addInitial(data, inport.process, inport.port, metadata);
  }

  addGraphInitialIndex(data: any, node: string, index: number, metadata: GraphIIPMetadata): GraphIIP | null {
    const inport = this.inports[node];
    if (!inport) { return null; }
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
  removeInitial(node: GraphNodeID, port: string) {
    const portName = this.getPortName(port);
    this.checkTransactionStart();

    this.initializers = this.initializers.filter((iip) => {
      if (iip.to.node === node && iip.to.port === portName) {
        this.emit('removeInitial', iip);
        return false;
      }
      return true;
    });

    this.checkTransactionEnd();
  }

  removeGraphInitial(node: string) {
    const inport = this.inports[node];
    if (!inport) { return; }
    this.removeInitial(inport.process, inport.port);
  }

  toDOT(): string {
    const cleanId = (id: string): string => id.replace(/"/g, '\\"');
    const cleanPort = (port: string): string => port.replace(/\./g, '');
    const wrapQuotes = (id: string): string => `"${cleanId(id)}"`;

    let dot = 'digraph {\n';

    this.nodes.forEach((node) => {
      dot += `    ${wrapQuotes(node.id)} [label=${wrapQuotes(node.id)} shape=box]\n`;
    });

    this.initializers.forEach((initializer, id) => {
      let data;
      if (typeof initializer.from.data === 'function') {
        data = 'Function';
      } else {
        data = JSON.stringify(initializer.from.data);
      }
      dot += `    data${id} [label=${wrapQuotes(data)} shape=plaintext]\n`;
      dot += `    data${id} -> ${wrapQuotes(initializer.to.node)}[headlabel=${cleanPort(initializer.to.port)} labelfontcolor=blue labelfontsize=8.0]\n`;
    });

    this.edges.forEach((edge) => {
      dot += `    ${wrapQuotes(edge.from.node)} -> ${wrapQuotes(edge.to.node)}[taillabel=${cleanPort(edge.from.port)} headlabel=${cleanPort(edge.to.port)} labelfontcolor=blue labelfontsize=8.0]\n`;
    });

    dot += '}';

    return dot;
  }

  toYUML():string {
    const yuml: Array<string> = [];

    this.initializers.forEach((initializer) => {
      yuml.push(`(start)[${initializer.to.port}]->(${initializer.to.node})`);
    });

    this.edges.forEach((edge) => {
      yuml.push(`(${edge.from.node})[${edge.from.port}]->(${edge.to.node})`);
    });

    return yuml.join(',');
  }

  toJSON(): GraphJson {
    const json: GraphJson = {
      caseSensitive: this.caseSensitive,
      properties: {
        name: this.name,
        ...this.properties,
      },
      inports: {
        ...this.inports,
      },
      outports: {
        ...this.outports,
      },
      groups: this.groups.map((group) => {
        const groupData: GraphGroup = {
          name: group.name,
          nodes: group.nodes,
        };
        if (group.metadata && Object.keys(group.metadata).length) {
          groupData.metadata = {
            ...group.metadata,
          };
        }
        return groupData;
      }),
      processes: {},
      connections: [],
    };

    this.nodes.forEach((node) => {
      if (!json.processes) {
        json.processes = {};
      }
      json.processes[node.id] = {
        component: node.component,
      };
      if (node.metadata) {
        json.processes[node.id].metadata = {
          ...node.metadata,
        };
      }
    });

    this.edges.forEach((edge) => {
      const connection: GraphJsonEdge = {
        src: {
          process: edge.from.node,
          port: edge.from.port,
          index: edge.from.index,
        },
        tgt: {
          process: edge.to.node,
          port: edge.to.port,
          index: edge.to.index,
        },
      };
      if (edge.metadata && Object.keys(edge.metadata).length) {
        connection.metadata = {
          ...edge.metadata,
        };
      }
      if (!json.connections) {
        json.connections = [];
      }
      json.connections.push(connection);
    });

    this.initializers.forEach((initializer: GraphIIP) => {
      const iip: GraphJsonEdge = {
        data: initializer.from.data,
        tgt: {
          process: initializer.to.node,
          port: initializer.to.port,
          index: initializer.to.index,
        },
      };
      if (initializer.metadata && Object.keys(initializer.metadata).length) {
        iip.metadata = {
          ...initializer.metadata,
        };
      }
      if (!json.connections) {
        json.connections = [];
      }
      json.connections.push(iip);
    });

    return json;
  }

  save(file: string, callback: (err: Error | null, filename?: string) => void) {
    if (isBrowser()) {
      callback(new Error('Saving graphs not supported on browser'));
      return;
    }

    const json = JSON.stringify(this.toJSON(), null, 4);
    let filename = file;
    if (!filename.match(/\.json$/)) {
      filename = `${file}.json`;
    }
    // eslint-disable-next-line global-require
    require('fs').writeFile(filename, json, 'utf-8', (err: Error | null) => {
      if (err) {
        callback(err);
        return;
      }
      callback(null, filename);
    });
  }
}

function createGraph(name: string, options: GraphOptions): Graph {
  return new Graph(name, options);
};

interface GraphLoadingCallback {
  (err: Error): void;
  (err: null, graph: Graph): void;
}
interface StringLoadingCallback {
  (err: Error): void;
  (err: null, result: string): void;
}

function loadJSON(passedDefinition: string | GraphJson, callback: GraphLoadingCallback, metadata: JournalMetadata = {}) {
  let definition: GraphJson;
  if (typeof passedDefinition === 'string') {
    definition = JSON.parse(passedDefinition);
  } else {
    definition = clone(passedDefinition);
  }

  if (!definition.properties) { definition.properties = {}; }
  if (!definition.processes) { definition.processes = {}; }
  if (!definition.connections) { definition.connections = []; }

  const graph = new Graph(definition.properties.name, {
    caseSensitive: definition.caseSensitive || false,
  });

  graph.startTransaction('loadJSON', metadata);
  const properties: PropertyMap = {};
  Object.keys(definition.properties).forEach((property) => {
    if (property === 'name') {
      return;
    }
    if (!definition.properties) {
      return;
    }
    const value: any = definition.properties[property];
    properties[property] = value;
  });
  graph.setProperties(properties);

  Object.keys(definition.processes).forEach((id) => {
    if (!definition.processes) {
      return;
    }
    const def = definition.processes[id];
    if (!def.metadata) { def.metadata = {}; }
    graph.addNode(id, def.component, def.metadata);
  });

  definition.connections.forEach((conn) => {
    const meta = conn.metadata ? conn.metadata : {};
    if (typeof conn.data !== 'undefined') {
      if (typeof conn.tgt.index === 'number') {
        graph.addInitialIndex(
          conn.data,
          conn.tgt.process,
          graph.getPortName(conn.tgt.port),
          conn.tgt.index,
          meta,
        );
      } else {
        graph.addInitial(
          conn.data,
          conn.tgt.process,
          graph.getPortName(conn.tgt.port),
          meta,
        );
      }
      return;
    }
    if (typeof conn.src === 'undefined') {
      return;
    }
    if ((typeof conn.src.index === 'number') || (typeof conn.tgt.index === 'number')) {
      graph.addEdgeIndex(
        conn.src.process,
        graph.getPortName(conn.src.port),
        conn.src.index,
        conn.tgt.process,
        graph.getPortName(conn.tgt.port),
        conn.tgt.index,
        meta,
      );
      return;
    }
    graph.addEdge(
      conn.src.process,
      graph.getPortName(conn.src.port),
      conn.tgt.process,
      graph.getPortName(conn.tgt.port),
      meta,
    );
  });

  if (definition.inports) {
    Object.keys(definition.inports).forEach((pub) => {
      if (!definition.inports || !definition.inports[pub]) {
        return;
      }
      const priv = definition.inports[pub];
      graph.addInport(pub, priv.process, graph.getPortName(priv.port), priv.metadata || {});
    });
  }
  if (definition.outports) {
    Object.keys(definition.outports).forEach((pub) => {
      if (!definition.outports || !definition.outports[pub]) {
        return;
      }
      const priv = definition.outports[pub];
      graph.addOutport(pub, priv.process, graph.getPortName(priv.port), priv.metadata || {});
    });
  }

  if (definition.groups) {
    definition.groups.forEach((group) => {
      graph.addGroup(group.name, group.nodes, group.metadata || {});
    });
  }

  graph.endTransaction('loadJSON');

  return callback(null, graph);
}

function loadFBP(fbpData: string, callback: GraphLoadingCallback, metadata: JournalMetadata = {}, caseSensitive = false) {
  let definition;
  try {
    // eslint-disable-next-line global-require
    definition = require('fbp').parse(fbpData, { caseSensitive });
  } catch (e) {
    return callback(e);
  }
  return loadJSON(definition, callback, metadata);
}

function loadHTTP(url: string, callback: StringLoadingCallback) {
  const req = new XMLHttpRequest();
  req.onreadystatechange = () => {
    if (req.readyState !== 4) { return; }
    if (req.status !== 200) {
      callback(new Error(`Failed to load ${url}: HTTP ${req.status}`));
    }
    callback(null, req.responseText);
  };
  req.open('GET', url, true);
  req.send();
}

function loadFile(file: string, callback: GraphLoadingCallback, metadata: JournalMetadata = {}, caseSensitive = false) {
  if (isBrowser()) {
    // On browser we can try getting the file via AJAX
    loadHTTP(file, (err: Error | null, data?: string) => {
      if (err) {
        callback(err);
        return;
      }
      if (!data) {
        callback(new Error('No data received'));
        return;
      }
      if (file.split('.').pop() === 'fbp') {
        loadFBP(data, callback, metadata);
        return;
      }
      loadJSON(data, callback, metadata);
    });
    return;
  }
  // Node.js graph file
  // eslint-disable-next-line global-require
  require('fs').readFile(file, 'utf-8', (err: Error, data: string) => {
    if (err) {
      callback(err);
      return;
    }

    if (file.split('.').pop() === 'fbp') {
      loadFBP(data, callback, {}, caseSensitive);
      return;
    }

    loadJSON(data, callback, {});
  });
}

// remove everything in the graph
function resetGraph(graph: Graph) {
  // Edges and similar first, to have control over the order
  // If we'd do nodes first, it will implicitly delete edges
  // Important to make journal transactions invertible
  graph.groups.reverse();
  graph.groups.forEach((group) => {
    if (group != null) {
      graph.removeGroup(group.name);
    }
  });
  Object.keys(graph.outports).forEach((port) => {
    graph.removeOutport(port);
  });
  Object.keys(graph.inports).forEach((port) => {
    graph.removeInport(port);
  });
  graph.setProperties({});
  graph.initializers.reverse();
  graph.initializers.forEach((iip) => {
    graph.removeInitial(iip.to.node, iip.to.port);
  });
  graph.edges.reverse();
  graph.edges.forEach((edge) => {
    graph.removeEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port);
  });
  graph.nodes.reverse();
  graph.nodes.forEach((node) => {
    graph.removeNode(node.id);
  });
}

// Note: Caller should create transaction
// First removes everything in @base, before building it up to mirror @to
function mergeResolveTheirsNaive(base: Graph, to: Graph) {
  resetGraph(base);

  to.nodes.forEach((node) => {
    base.addNode(node.id, node.component, node.metadata);
  });
  to.edges.forEach((edge) => {
    base.addEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port, edge.metadata);
  });
  to.initializers.forEach((iip) => {
    if (typeof iip.to.index === 'number') {
      base.addInitialIndex(iip.from.data, iip.to.node, iip.to.port, iip.to.index, iip.metadata || {});
      return;
    }
    base.addInitial(iip.from.data, iip.to.node, iip.to.port, iip.metadata || {});
  });
  base.setProperties(to.properties);
  Object.keys(to.inports).forEach((pub) => {
    const priv = to.inports[pub];
    base.addInport(pub, priv.process, priv.port, priv.metadata || {});
  });
  Object.keys(to.outports).forEach((pub) => {
    const priv = to.outports[pub];
    base.addOutport(pub, priv.process, priv.port, priv.metadata || {});
  });
  to.groups.forEach((group) => {
    base.addGroup(group.name, group.nodes, group.metadata || {});
  });
}

function equivalent(a: Graph, b: Graph): boolean {
  // TODO: add option to only compare known fields
  // TODO: add option to ignore metadata
  return (JSON.stringify(a) === JSON.stringify(b));
}

export {
  Graph,
  createGraph,
  loadJSON,
  loadFBP,
  loadFile,
  equivalent,
  mergeResolveTheirsNaive as mergeResolveTheirs,
};
