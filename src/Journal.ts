//     FBP Graph Journal
//     (c) 2016-2017 Flowhub UG
//     (c) 2014 Jon Nordby
//     (c) 2013 Flowhub UG
//     (c) 2011-2012 Henri Bergius, Nemein
//     FBP Graph may be freely distributed under the MIT license

import { EventEmitter } from 'events';
import * as clone from 'clone';
import Graph from './Graph';
import JournalStore from './JournalStore';
import MemoryJournalStore from './MemoryJournalStore';
import {
  TransactionEntry,
  JournalMetadata,
} from './Types';

function entryToPrettyString(entry: TransactionEntry): string {
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
    case 'changeProperties': return 'PROPERTIES';
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
}

// To set, not just update (append) metadata
function calculateMeta(oldMeta: JournalMetadata, newMeta: JournalMetadata): JournalMetadata {
  const setMeta: JournalMetadata = {};
  Object.keys(oldMeta).forEach((k) => {
    setMeta[k] = null;
  });
  Object.keys(newMeta).forEach((k) => {
    const v = newMeta[k];
    setMeta[k] = v;
  });
  return setMeta;
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
  graph: Graph;
  entries: Array<TransactionEntry>;
  subscribed: boolean;
  store: JournalStore;
  currentRevision: number;
  constructor(graph: Graph, metadata: JournalMetadata, store: JournalStore) {
    super();
    this.graph = graph;
    // Entries added during this revision
    this.entries = [];
    // Whether we should respond to graph change notifications or not
    this.subscribed = true;
    this.store = store || new MemoryJournalStore(this.graph);

    if (this.store.countTransactions() === 0) {
      // Sync journal with current graph to start transaction history
      this.currentRevision = -1;
      this.startTransaction('initial', metadata);
      this.graph.nodes.forEach((node) => {
        this.appendCommand('addNode', node);
      });
      this.graph.edges.forEach((edge) => {
        this.appendCommand('addEdge', edge);
      });
      this.graph.initializers.forEach((iip) => {
        this.appendCommand('addInitial', iip);
      });
      if (Object.keys(this.graph.properties).length > 0) {
        this.appendCommand('changeProperties', this.graph.properties);
      }
      Object.keys(this.graph.inports).forEach((name) => {
        const port = this.graph.inports[name];
        this.appendCommand('addInport', {
          name,
          port,
        });
      });
      Object.keys(this.graph.outports).forEach((name) => {
        const port = this.graph.outports[name];
        this.appendCommand('addOutport', {
          name,
          port,
        });
      });
      this.graph.groups.forEach((group) => {
        this.appendCommand('addGroup', group);
      });
      this.endTransaction('initial', metadata);
    } else {
      // Persistent store, start with its latest rev
      this.currentRevision = this.store.lastRevision;
    }

    // Subscribe to graph changes
    this.graph.on('addNode', (node) => {
      this.appendCommand('addNode', node);
    });
    this.graph.on('removeNode', (node) => {
      this.appendCommand('removeNode', node);
    });
    this.graph.on('renameNode', (oldId, newId) => {
      const args = {
        oldId,
        newId,
      };
      this.appendCommand('renameNode', args);
    });
    this.graph.on('changeNode', (node, oldMeta) => {
      this.appendCommand('changeNode', {
        id: node.id,
        new: node.metadata,
        old: oldMeta,
      });
    });
    this.graph.on('addEdge', (edge) => {
      this.appendCommand('addEdge', edge);
    });
    this.graph.on('removeEdge', (edge) => {
      this.appendCommand('removeEdge', edge);
    });
    this.graph.on('changeEdge', (edge, oldMeta) => {
      this.appendCommand('changeEdge', {
        from: edge.from,
        to: edge.to,
        new: edge.metadata,
        old: oldMeta,
      });
    });
    this.graph.on('addInitial', (iip) => {
      this.appendCommand('addInitial', iip);
    });
    this.graph.on('removeInitial', (iip) => {
      this.appendCommand('removeInitial', iip);
    });

    this.graph.on('changeProperties', (newProps, oldProps) => this.appendCommand('changeProperties', { new: newProps, old: oldProps }));

    this.graph.on('addGroup', (group) => this.appendCommand('addGroup', group));
    this.graph.on('renameGroup', (oldName, newName) => this.appendCommand('renameGroup', {
      oldName,
      newName,
    }));
    this.graph.on('removeGroup', (group) => this.appendCommand('removeGroup', group));
    this.graph.on('changeGroup', (group, oldMeta) => this.appendCommand('changeGroup', { name: group.name, new: group.metadata, old: oldMeta }));

    this.graph.on('addExport', (exported) => this.appendCommand('addExport', exported));
    this.graph.on('removeExport', (exported) => this.appendCommand('removeExport', exported));

    this.graph.on('addInport', (name, port) => this.appendCommand('addInport', { name, port }));
    this.graph.on('removeInport', (name, port) => this.appendCommand('removeInport', { name, port }));
    this.graph.on('renameInport', (oldId, newId) => this.appendCommand('renameInport', { oldId, newId }));
    this.graph.on('changeInport', (name, port, oldMeta) => this.appendCommand('changeInport', { name, new: port.metadata, old: oldMeta }));
    this.graph.on('addOutport', (name, port) => this.appendCommand('addOutport', { name, port }));
    this.graph.on('removeOutport', (name, port) => this.appendCommand('removeOutport', { name, port }));
    this.graph.on('renameOutport', (oldId, newId) => this.appendCommand('renameOutport', { oldId, newId }));
    this.graph.on('changeOutport', (name, port, oldMeta) => this.appendCommand('changeOutport', { name, new: port.metadata, old: oldMeta }));

    this.graph.on('startTransaction', (id, meta) => {
      this.startTransaction(id, meta);
    });
    this.graph.on('endTransaction', (id, meta) => {
      this.endTransaction(id, meta);
    });
  }

  startTransaction(id: string, meta: JournalMetadata) {
    if (!this.subscribed) { return; }
    if (this.entries.length > 0) {
      throw Error('Inconsistent @entries');
    }
    this.currentRevision += 1;
    this.appendCommand('startTransaction', {
      id,
      metadata: meta,
    }, this.currentRevision);
  }

  endTransaction(id: string, meta: JournalMetadata) {
    if (!this.subscribed) {
      return;
    }

    this.appendCommand('endTransaction', {
      id, metadata: meta,
    }, this.currentRevision);
    // TODO: this would be the place to refine @entries into
    // a minimal set of changes, like eliminating changes early in transaction
    // which were later reverted/overwritten
    this.store.putTransaction(this.currentRevision, this.entries);
    this.entries = [];
  }

  appendCommand(cmd: string, args: object, rev: number | null = null) {
    if (!this.subscribed) {
      return;
    }

    const entry: TransactionEntry = {
      cmd,
      args: clone(args),
      rev: rev,
    };
    this.entries.push(entry);
  }

  executeEntry(entry: TransactionEntry) {
    const a = entry.args;
    switch (entry.cmd) {
      case 'addNode': return this.graph.addNode(a.id, a.component);
      case 'removeNode': return this.graph.removeNode(a.id);
      case 'renameNode': return this.graph.renameNode(a.oldId, a.newId);
      case 'changeNode': return this.graph.setNodeMetadata(a.id, calculateMeta(a.old, a.new));
      case 'addEdge': return this.graph.addEdge(a.from.node, a.from.port, a.to.node, a.to.port);
      case 'removeEdge': return this.graph.removeEdge(a.from.node, a.from.port, a.to.node, a.to.port);
      case 'changeEdge': return this.graph.setEdgeMetadata(a.from.node, a.from.port, a.to.node, a.to.port, calculateMeta(a.old, a.new));
      case 'addInitial': {
        if (typeof a.to.index === 'number') {
          return this.graph.addInitialIndex(a.from.data, a.to.node, a.to.port, a.to.index, a.metadata);
        }
        return this.graph.addInitial(a.from.data, a.to.node, a.to.port, a.metadata);
      }
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

  executeEntryInversed(entry: TransactionEntry) {
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
      case 'removeInitial': {
        if (typeof a.to.index === 'number') {
          return this.graph.addInitialIndex(a.from.data, a.to.node, a.to.port, a.to.index, a.metadata);
        }
        return this.graph.addInitial(a.from.data, a.to.node, a.to.port, a.metadata);
      }
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

  moveToRevision(revId: number) {
    if (revId === this.currentRevision) {
      return;
    }

    this.subscribed = false;

    if (revId > this.currentRevision) {
      // Forward replay journal to revId
      for (let start = this.currentRevision + 1, r = start, end = revId, asc = start <= end;
        asc ? r <= end : r >= end;
        asc ? r += 1 : r -= 1) {
        this.store.fetchTransaction(r).forEach((entry) => {
          this.executeEntry(entry);
        });
      }
    } else {
      // Move backwards, and apply inverse changes
      for (let r = this.currentRevision, end = revId + 1; r >= end; r -= 1) {
        // Apply entries in reverse order
        const entries = this.store.fetchTransaction(r).slice(0);
        entries.reverse();
        entries.forEach((entry) => {
          this.executeEntryInversed(entry);
        });
      }
    }

    this.currentRevision = revId;
    this.subscribed = true;
  }

  // ## Undoing & redoing
  // Undo the last graph change
  undo() {
    if (!this.canUndo()) { return; }
    this.moveToRevision(this.currentRevision - 1);
  }

  // If there is something to undo
  canUndo(): boolean {
    return this.currentRevision > 0;
  }

  // Redo the last undo
  redo() {
    if (!this.canRedo()) { return; }
    this.moveToRevision(this.currentRevision + 1);
  }

  // If there is something to redo
  canRedo(): boolean {
    return this.currentRevision < this.store.lastRevision;
  }

  // # Serializing
  // Render a pretty printed string of the journal. Changes are abbreviated
  toPrettyString(startRev = 0, endRevParam?: number): string {
    const endRev = endRevParam || this.store.lastRevision;
    const lines: Array<string> = [];
    for (let r = startRev, end = endRev, asc = startRev <= end;
      asc ? r < end : r > end;
      asc ? r += 1 : r -= 1) {
      const e = this.store.fetchTransaction(r);
      e.forEach((entry) => {
        lines.push(entryToPrettyString(entry));
      });
    }
    return lines.join('\n');
  }

  // Serialize journal to JSON
  toJSON(startRev = 0, endRevParam = null) {
    const endRev = endRevParam || this.store.lastRevision;
    const entries: Array<string> = [];
    for (let r = startRev, end = endRev; r < end; r += 1) {
      const e = this.store.fetchTransaction(r);
      e.forEach((entry) => {
        entries.push(entryToPrettyString(entry));
      });
    }
    return entries;
  }

  save(file: string, callback: (err: NodeJS.ErrnoException | null) => void) {
    const json = JSON.stringify(this.toJSON(), null, 4);
    const { writeFile } = require('fs');
    // eslint-disable-next-line global-require
    writeFile(`${file}.json`, json, 'utf-8', callback);
  }
}

export {
  Journal,
  JournalStore,
  MemoryJournalStore,
};
