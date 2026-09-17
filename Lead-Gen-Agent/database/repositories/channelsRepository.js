'use strict';

const BaseRepository = require('./baseRepository');

class ChannelsRepository extends BaseRepository {
  constructor() {
    super('channels', { jsonFields: ['config'] });
  }

  list() {
    return this.hydrateAll(this.db.prepare('SELECT * FROM channels ORDER BY key ASC').all());
  }

  findByKey(key) {
    return this.hydrate(this.db.prepare('SELECT * FROM channels WHERE key = ?').get(key));
  }

  setEnabled(key, enabled) {
    const row = this.findByKey(key);
    if (!row) return null;
    return this.update(row.id, { enabled: enabled ? 1 : 0 });
  }

  saveConfig(key, config) {
    const row = this.findByKey(key);
    if (!row) return null;
    return this.update(row.id, { config: { ...(row.config || {}), ...config } });
  }
}

module.exports = new ChannelsRepository();
