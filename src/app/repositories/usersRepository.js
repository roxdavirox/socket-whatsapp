// docs: https://rethinkdb.com/docs/permissions-and-accounts/
const rethinkDb = require('rethinkdb');

function UsersRepository() {
  return {
    async getUserByEmail(email) {
      return new Promise((resolve, reject) => {
        const handleResolveUser = (error, user) => {
          if (error) reject(error);
          resolve(user);
        };
        const getFirstUser = cursor => cursor.next(handleResolveUser);
        rethinkDb
          .table('users')
          .filter({ email })
          .run(global.connection)
          .then(getFirstUser);
      })
    }
  }
}

module.exports = UsersRepository();