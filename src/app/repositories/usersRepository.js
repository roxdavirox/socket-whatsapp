// docs: https://rethinkdb.com/docs/permissions-and-accounts/
const rethinkDb = require('rethinkdb');

function UsersRepository() {
  return {
    async getUserByEmail(email) {
      return new Promise((resolve, reject) => {
        const resolveFirstUser = (error, users) => {
          if (error) resolve('user not found error:', error);
          const [user] = users;
          if (!user) resolve(false);
          resolve(user);
        };
        rethinkDb
          .table('users')
          .filter({ email })
          .run(global.connection)
          .then(cursor => cursor.toArray(resolveFirstUser));
      })
    }
  }
}

module.exports = UsersRepository();