// docs: https://rethinkdb.com/docs/permissions-and-accounts/
const rethinkDb = require('rethinkdb');

function UsersRepository() {
  return {
    async getUserByEmail(email) {
      return new Promise((resolve, reject) => {
        const getFirstUser = (error, users) => {
          if (error) {
            reject(`user not found error: ${error}`);
            return false;
          };
          const [user] = users;
          if (!user) {
            resolve(false);
            return false;
          }
          resolve(user);
        };
        rethinkDb
          .table('users')
          .filter({ email })
          .run(global.connection)
          .then(cursor => cursor.toArray(getFirstUser));
      })
    }
  }
}

module.exports = UsersRepository();