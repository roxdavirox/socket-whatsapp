const rethinkDb = require('rethinkdb');
const config = require('../../config.json');

const user = process.env.RETHINK_DB_USER;
const password = process.env.RETHINK_DB_PASSWORD;

const options = {
  ...config.rethinkdb,
  db: 'whats',
  user,
  password,
};

module.exports = rethinkDb.connect(options);
