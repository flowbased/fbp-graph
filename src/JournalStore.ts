import { EventEmitter } from 'events';
import { Graph } from './Graph';
import { TransactionEntry } from './Types';

/**
 * General interface for journal storage
 */
export default abstract class JournalStore extends EventEmitter {
  graph: Graph;
  lastRevision: number;
  constructor(graph: Graph) {
    super();
    this.graph = graph;
    this.lastRevision = 0;
  }

  countTransactions(): number {
    return 0;
  }

  putTransaction(revId: number, entries: Array<TransactionEntry>) {
    if (revId > this.lastRevision) {
      this.lastRevision = revId;
    }
    this.emit('transaction', revId, entries);
  }

  fetchTransaction(revId: number): Array<TransactionEntry> {
    return [];
  }
}
