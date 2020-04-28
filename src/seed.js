const r = require('rethinkdb');
const config = require('./config.json');
let conn;

r.connect(config.rethinkdb)
    .then(connection => {
        console.log('Connecting RethinkDB...');
        conn = connection;
        return r.dbCreate('whats').run(conn);
    })
    .then(() => {
        console.log('Database "whats" created!');
        return r.db('whats').tableCreate('chats').run(conn);
    })
    .then(() => console.log('Table "chats" created!'))
    .error(err => console.log(err))
    .finally(() => process.exit(0));