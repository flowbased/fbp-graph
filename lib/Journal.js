/*
 * decaffeinate suggestions:
 * DS002: Fix invalid constructor
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//     FBP Graph Journal
//     (c) 2016-2017 Flowhub UG
//     (c) 2014 Jon Nordby
//     (c) 2013 Flowhub UG
//     (c) 2011-2012 Henri Bergius, Nemein
//     FBP Graph may be freely distributed under the MIT license
//

const {EventEmitter} = require('events');

const clone = require('clone');

const entryToPrettyString = function(entry) {
  const a = entry.args;
  switch (entry.cmd) {
    case 'addNode': return `${a.id}(${a.component})`;
    case 'removeNode': return `DEL ${a.id}(${a.component})`;
    case 'renameNode': return `RENAME ${a.oldId} ${a.newId}`;
    case 'changeNode': return `META ${a.id}`;
    case 'addEdge': return `${a.from.node} ${a.from.port} -> ${a.to.port} ${a.to.node}`;
    case 'removeEdge': return `${a.from.node} ${a.from.port} -X> ${a.to.port} ${a.to.node}`;
    case 'changeEdge': return `META ${a.from.node} ${a.from.port} -> ${a.to.port} ${a.to.node}`;
    case 'addInitial': return `'${a.from.data}' -> ${a.to.port} ${a.to.node}`;
    case 'removeInitial': return `'${a.from.data}' -X> ${a.to.port} ${a.to.node}`;
    case 'startTransaction': return `>>> ${entry.rev}: ${a.id}`;
    case 'endTransaction': return `<<< ${entry.rev}: ${a.id}`;
    case 'changeProperties': return "PROPERTIES";
    case 'addGroup': return `GROUP ${a.name}`;
    case 'renameGroup': return `RENAME GROUP ${a.oldName} ${a.newName}`;
    case 'removeGroup': return `DEL GROUP ${a.name}`;
    case 'changeGroup': return `META GROUP ${a.name}`;
    case 'addInport': return `INPORT ${a.name}`;
    case 'removeInport': return `DEL INPORT ${a.name}`;
    case 'renameInport': return `RENAME INPORT ${a.oldId} ${a.newId}`;
    case 'changeInport': return `META INPORT ${a.name}`;
    case 'addOutport': return `OUTPORT ${a.name}`;
    case 'removeOutport': return `DEL OUTPORT ${a.name}`;
    case 'renameOutport': return `RENAME OUTPORT ${a.oldId} ${a.newId}`;
    case 'changeOutport': return `META OUTPORT ${a.name}`;
    default: throw new Error(`Unknown journal entry: ${entry.cmd}`);
  }
};

// To set, not just update (append) metadata
const calculateMeta = function(oldMeta, newMeta) {
  let k, v;
  const setMeta = {};
  for (k in oldMeta) {
    v = oldMeta[k];
    setMeta[k] = null;
  }
  for (k in newMeta) {
    v = newMeta[k];
    setMeta[k] = v;
  }
  return setMeta;
};


class JournalStore extends EventEmitter {
  static initClass() {
    this.prototype.lastRevision = 0;
  }
  constructor(graph) {
    super();
    this.graph = graph;
    this.lastRevision = 0;
  }
  putTransaction(revId, entries) {
    if (revId > this.lastRevision) { this.lastRevision = revId; }
    return this.emit('transaction', revId);
  }
  fetchTransaction(revId, entries) {}
}
JournalStore.initClass();

class MemoryJournalStore extends JournalStore {
  constructor(graph) {
    super(graph);
    this.transactions = [];
  }

  putTransaction(revId, entries) {
    super.putTransaction(revId, entries);
    return this.transactions[revId] = entries;
  }

  fetchTransaction(revId) {
    return this.transactions[revId];
  }
}

// ## Journalling graph changes
//
// The Journal can follow graph changes, store them
// and allows to recall previous revisions of the graph.
//
// Revisions stored in the journal follow the transactions of the graph.
// It is not possible to operate on smaller changes than individual transactions.
// Use startTransaction and endTransaction on Graph to structure the revisions logical changesets.
class Journal extends EventEmitter {
  static initClass() {
    this.prototype.graph = null;
    this.prototype.entries = []; // Entries added during this revision
    this.prototype.subscribed = true;
     // Whether we should respond to graph change notifications or not
  }

  constructor(graph, metadata, store) {
    this.startTransaction = this.startTransaction.bind(this);
    this.endTransaction = this.endTransaction.bind(this);
    super();
    this.graph = graph;
    this.entries = [];
    this.subscribed = true;
    this.store = store || new MemoryJournalStore(this.graph);

    if (this.store.transactions.length === 0) {
      // Sync journal with current graph to start transaction history
      let k, v;
      this.currentRevision = -1;
      this.startTransaction('initial', metadata);
      for (let node of Array.from(this.graph.nodes)) { this.appendCommand('addNode', node); }
      for (let edge of Array.from(this.graph.edges)) { this.appendCommand('addEdge', edge); }
      for (let iip of Array.from(this.graph.initializers)) { this.appendCommand('addInitial', iip); }
      if (Object.keys(this.graph.properties).length > 0) { this.appendCommand('changeProperties', this.graph.properties, {}); }
      for (k in this.graph.inports) { v = this.graph.inports[k]; this.appendCommand('addInport', {name: k, port: v}); }
      for (k in this.graph.outports) { v = this.graph.outports[k]; this.appendCommand('addOutport', {name: k, port: v}); }
      for (let group of Array.from(this.graph.groups)) { this.appendCommand('addGroup', group); }
      this.endTransaction('initial', metadata);
    } else {
      // Persistent store, start with its latest rev
      this.currentRevision = this.store.lastRevision;
    }

    // Subscribe to graph changes
    this.graph.on('addNode', node => {
      return this.appendCommand('addNode', node);
    });
    this.graph.on('removeNode', node => {
      return this.appendCommand('removeNode', node);
    });
    this.graph.on('renameNode', (oldId, newId) => {
      const args = {
        oldId,
        newId
      };
      return this.appendCommand('renameNode', args);
    });
    this.graph.on('changeNode', (node, oldMeta) => {
      return this.appendCommand('changeNode', {id: node.id, new: node.metadata, old: oldMeta});
  });
    this.graph.on('addEdge', edge => {
      return this.appendCommand('addEdge', edge);
    });
    this.graph.on('removeEdge', edge => {
      return this.appendCommand('removeEdge', edge);
    });
    this.graph.on('changeEdge', (edge, oldMeta) => {
      return this.appendCommand('changeEdge', {from: edge.from, to: edge.to, new: edge.metadata, old: oldMeta});
  });
    this.graph.on('addInitial', iip => {
      return this.appendCommand('addInitial', iip);
    });
    this.graph.on('removeInitial', iip => {
      return this.appendCommand('removeInitial', iip);
    });

    this.graph.on('changeProperties', (newProps, oldProps) => {
      return this.appendCommand('changeProperties', {new: newProps, old: oldProps});
  });

    this.graph.on('addGroup', group => {
      return this.appendCommand('addGroup', group);
    });
    this.graph.on('renameGroup', (oldName, newName) => {
      return this.appendCommand('renameGroup', {
        oldName,
        newName
      }
      );
    });
    this.graph.on('removeGroup', group => {
      return this.appendCommand('removeGroup', group);
    });
    this.graph.on('changeGroup', (group, oldMeta) => {
      return this.appendCommand('changeGroup', {name: group.name, new: group.metadata, old: oldMeta});
  });

    this.graph.on('addExport', exported => {
      return this.appendCommand('addExport', exported);
    });
    this.graph.on('removeExport', exported => {
      return this.appendCommand('removeExport', exported);
    });

    this.graph.on('addInport', (name, port) => {
      return this.appendCommand('addInport', {name, port});
  });
    this.graph.on('removeInport', (name, port) => {
      return this.appendCommand('removeInport', {name, port});
  });
    this.graph.on('renameInport', (oldId, newId) => {
      return this.appendCommand('renameInport', {oldId, newId});
  });
    this.graph.on('changeInport', (name, port, oldMeta) => {
      return this.appendCommand('changeInport', {name, new: port.metadata, old: oldMeta});
  });
    this.graph.on('addOutport', (name, port) => {
      return this.appendCommand('addOutport', {name, port});
  });
    this.graph.on('removeOutport', (name, port) => {
      return this.appendCommand('removeOutport', {name, port});
  });
    this.graph.on('renameOutport', (oldId, newId) => {
      return this.appendCommand('renameOutport', {oldId, newId});
  });
    this.graph.on('changeOutport', (name, port, oldMeta) => {
      return this.appendCommand('changeOutport', {name, new: port.metadata, old: oldMeta});
  });

    this.graph.on('startTransaction', (id, meta) => {
      return this.startTransaction(id, meta);
    });
    this.graph.on('endTransaction', (id, meta) => {
      return this.endTransaction(id, meta);
    });
  }

  startTransaction(id, meta) {
    if (!this.subscribed) { return; }
    if (this.entries.length > 0) {
      throw Error("Inconsistent @entries");
    }
    this.currentRevision++;
    return this.appendCommand('startTransaction', {id, metadata: meta}, this.currentRevision);
  }

  endTransaction(id, meta) {
    if (!this.subscribed) { return; }

    this.appendCommand('endTransaction', {id, metadata: meta}, this.currentRevision);
    // TODO: this would be the place to refine @entries into
    // a minimal set of changes, like eliminating changes early in transaction
    // which were later reverted/overwritten
    this.store.putTransaction(this.currentRevision, this.entries);
    return this.entries = [];
  }

  appendCommand(cmd, args, rev) {
    if (!this.subscribed) { return; }

    const entry = {
      cmd,
      args: clone(args)
    };
    if (rev != null) { entry.rev = rev; }
    return this.entries.push(entry);
  }

  executeEntry(entry) {
    const a = entry.args;
    switch (entry.cmd) {
      case 'addNode': return this.graph.addNode(a.id, a.component);
      case 'removeNode': return this.graph.removeNode(a.id);
      case 'renameNode': return this.graph.renameNode(a.oldId, a.newId);
      case 'changeNode': return this.graph.setNodeMetadata(a.id, calculateMeta(a.old, a.new));
      case 'addEdge': return this.graph.addEdge(a.from.node, a.from.port, a.to.node, a.to.port);
      case 'removeEdge': return this.graph.removeEdge(a.from.node, a.from.port, a.to.node, a.to.port);
      case 'changeEdge': return this.graph.setEdgeMetadata(a.from.node, a.from.port, a.to.node, a.to.port, calculateMeta(a.old, a.new));
      case 'addInitial': return this.graph.addInitial(a.from.data, a.to.node, a.to.port);
      case 'removeInitial': return this.graph.removeInitial(a.to.node, a.to.port);
      case 'startTransaction': return null;
      case 'endTransaction': return null;
      case 'changeProperties': return this.graph.setProperties(a.new);
      case 'addGroup': return this.graph.addGroup(a.name, a.nodes, a.metadata);
      case 'renameGroup': return this.graph.renameGroup(a.oldName, a.newName);
      case 'removeGroup': return this.graph.removeGroup(a.name);
      case 'changeGroup': return this.graph.setGroupMetadata(a.name, calculateMeta(a.old, a.new));
      case 'addInport': return this.graph.addInport(a.name, a.port.process, a.port.port, a.port.metadata);
      case 'removeInport': return this.graph.removeInport(a.name);
      case 'renameInport': return this.graph.renameInport(a.oldId, a.newId);
      case 'changeInport': return this.graph.setInportMetadata(a.name, calculateMeta(a.old, a.new));
      case 'addOutport': return this.graph.addOutport(a.name, a.port.process, a.port.port, a.port.metadata(a.name));
      case 'removeOutport': return this.graph.removeOutport;
      case 'renameOutport': return this.graph.renameOutport(a.oldId, a.newId);
      case 'changeOutport': return this.graph.setOutportMetadata(a.name, calculateMeta(a.old, a.new));
      default: throw new Error(`Unknown journal entry: ${entry.cmd}`);
    }
  }

  executeEntryInversed(entry) {
    const a = entry.args;
    switch (entry.cmd) {
      case 'addNode': return this.graph.removeNode(a.id);
      case 'removeNode': return this.graph.addNode(a.id, a.component);
      case 'renameNode': return this.graph.renameNode(a.newId, a.oldId);
      case 'changeNode': return this.graph.setNodeMetadata(a.id, calculateMeta(a.new, a.old));
      case 'addEdge': return this.graph.removeEdge(a.from.node, a.from.port, a.to.node, a.to.port);
      case 'removeEdge': return this.graph.addEdge(a.from.node, a.from.port, a.to.node, a.to.port);
      case 'changeEdge': return this.graph.setEdgeMetadata(a.from.node, a.from.port, a.to.node, a.to.port, calculateMeta(a.new, a.old));
      case 'addInitial': return this.graph.removeInitial(a.to.node, a.to.port);
      case 'removeInitial': return this.graph.addInitial(a.from.data, a.to.node, a.to.port);
      case 'startTransaction': return null;
      case 'endTransaction': return null;
      case 'changeProperties': return this.graph.setProperties(a.old);
      case 'addGroup': return this.graph.removeGroup(a.name);
      case 'renameGroup': return this.graph.renameGroup(a.newName, a.oldName);
      case 'removeGroup': return this.graph.addGroup(a.name, a.nodes, a.metadata);
      case 'changeGroup': return this.graph.setGroupMetadata(a.name, calculateMeta(a.new, a.old));
      case 'addInport': return this.graph.removeInport(a.name);
      case 'removeInport': return this.graph.addInport(a.name, a.port.process, a.port.port, a.port.metadata);
      case 'renameInport': return this.graph.renameInport(a.newId, a.oldId);
      case 'changeInport': return this.graph.setInportMetadata(a.name, calculateMeta(a.new, a.old));
      case 'addOutport': return this.graph.removeOutport(a.name);
      case 'removeOutport': return this.graph.addOutport(a.name, a.port.process, a.port.port, a.port.metadata);
      case 'renameOutport': return this.graph.renameOutport(a.newId, a.oldId);
      case 'changeOutport': return this.graph.setOutportMetadata(a.name, calculateMeta(a.new, a.old));
      default: throw new Error(`Unknown journal entry: ${entry.cmd}`);
    }
  }

  moveToRevision(revId) {
    let r;
    if (revId === this.currentRevision) { return; }

    this.subscribed = false;

    if (revId > this.currentRevision) {
      // Forward replay journal to revId
      let asc, end, start;
      for (start = this.currentRevision+1, r = start, end = revId, asc = start <= end; asc ? r <= end : r >= end; asc ? r++ : r--) {
        for (let entry of Array.from(this.store.fetchTransaction(r))) { this.executeEntry(entry); }
      }

    } else {
      // Move backwards, and apply inverse changes
      let end1;
      for (r = this.currentRevision, end1 = revId+1; r >= end1; r--) {
        const entries = this.store.fetchTransaction(r);
        for (let i = entries.length-1; i >= 0; i--) {
          this.executeEntryInversed(entries[i]);
        }
      }
    }

    this.currentRevision = revId;
    return this.subscribed = true;
  }

  // ## Undoing & redoing
  // Undo the last graph change
  undo() {
    if (!this.canUndo()) { return; }
    return this.moveToRevision(this.currentRevision-1);
  }

  // If there is something to undo
  canUndo() {
    return this.currentRevision > 0;
  }

  // Redo the last undo
  redo() {
    if (!this.canRedo()) { return; }
    return this.moveToRevision(this.currentRevision+1);
  }

  // If there is something to redo
  canRedo() {
    return this.currentRevision < this.store.lastRevision;
  }

  //# Serializing
  // Render a pretty printed string of the journal. Changes are abbreviated
  toPrettyString(startRev, endRev) {
    startRev |= 0;
    endRev |= this.store.lastRevision;
    const lines = [];
    for (let r = startRev, end = endRev, asc = startRev <= end; asc ? r < end : r > end; asc ? r++ : r--) {
      const e = this.store.fetchTransaction(r);
      for (let entry of Array.from(e)) { lines.push((entryToPrettyString(entry))); }
    }
    return lines.join('\n');
  }

  // Serialize journal to JSON
  toJSON(startRev, endRev) {
    startRev |= 0;
    endRev |= this.store.lastRevision;
    const entries = [];
    for (let r = startRev, end = endRev; r < end; r++) {
      for (let entry of Array.from(this.store.fetchTransaction(r))) { entries.push((entryToPrettyString(entry))); }
    }
    return entries;
  }

  save(file, success) {
    const json = JSON.stringify(this.toJSON(), null, 4);
    return require('fs').writeFile(`${file}.json`, json, "utf-8", function(err, data) {
      if (err) { throw err; }
      return success(file);
    });
  }
}
Journal.initClass();

exports.Journal = Journal;
exports.JournalStore = JournalStore;
exports.MemoryJournalStore = MemoryJournalStore;
