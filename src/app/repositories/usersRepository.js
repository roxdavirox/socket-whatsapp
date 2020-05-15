// doc https://rethinkdb.com/docs/permissions-and-accounts/
const rethinkDb = require('rethinkdb');

function UsersRepository() {
  return {
    getUserByEmail(email, connection) {
      return new Promise((resolve, reject) => {
        const filterUserQuery = rethinkDb
          .table('users')
          .filter({ email });

        const userResponse = filterUserQuery.run(connection);
        
        const handleResolveUser = (error, user) => {
          if (error) reject(error);
          resolve(user);
        };

        const resolveUser = cursor => cursor.next(handleResolveUser);

        userResponse.then(resolveUser);
      })
    }
  }
}

module.exports = UsersRepository();