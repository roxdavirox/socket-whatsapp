const rethinkDb = require('rethinkdb');

const fs = require('fs');

const config = require('../../config.json');

const authKey = process.env.RETHINK_DB_AUTH_KEY;

const cert = fs.readFileSync('./cacert.crt');

const { host, port, db } = config.rethinkdb;

module.exports = rethinkDb.connect({
  host,
  port,
  db,
  authKey,
  ssl: {
    ca: cert,
  },
});
