const JournalStore = require('./JournalStore');

class MemoryJournalStore extends JournalStore {
  constructor(graph) {
    super(graph);
    this.transactions = [];
  }

  putTransaction(revId, entries) {
    super.putTransaction(revId, entries);
    this.transactions[revId] = entries;
  }

  fetchTransaction(revId) {
    return this.transactions[revId];
  }
}

module.exports = MemoryJournalStore;
