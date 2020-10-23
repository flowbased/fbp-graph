const { EventEmitter } = require('events');

class JournalStore extends EventEmitter {
  constructor(graph) {
    super();
    this.graph = graph;
    this.lastRevision = 0;
  }

  putTransaction(revId, entries) {
    if (revId > this.lastRevision) {
      this.lastRevision = revId;
    }
    return this.emit('transaction', revId, entries);
  }

  // eslint-disable-next-line class-methods-use-this
  fetchTransaction() {
  }
}

module.exports = JournalStore;
