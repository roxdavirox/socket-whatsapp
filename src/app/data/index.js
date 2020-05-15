const rethinkDb = require('rethinkdb');
const config = require('../../config.json');

const db = { ...config.rethinkdb, db: 'whats' };

module.exports = rethinkDb.connect(db);
