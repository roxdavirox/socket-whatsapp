const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../../config.json');

const userRepository = require('../repositories/usersRepository');
const router = express.Router();

const createToken = (params = {}) => jwt.sign(params, config.jwt.secret, {
  expiresIn: 86400.0,
});
// TODO: substituir mongodb por rethinkdb queries - usar repositories
// const registerNewUser = async (req, res) => {
//   const { email } = req.body;

//   try {
//     if (await User.findOne({ email })) {
//       return res.status(400).send({ error: 'Usuário já existe' });
//     }

//     const user = await User.create(req.body);

//     user.password = undefined;

//     return res.send({ user, auth: true, token: createToken({ id: user.id }) });
//   } catch (err) {
//     return res.status(400).send({
//       error: 'Registration fail',
//     });
//   }
// };



// router.post('/register', registerNewUser);

module.exports = ({ app }) => {
  const authenticateUser = async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log('email', email);
      const user = await userRepository.getUserByEmail(email);
  
      if (!user) { 
        return res
          .status(400)
          .send({ error: 'User not found' });
        }
  
      // usar bcrypt
      // if (!await bcrypt.compare(password, user.password)) {
      if(user.password !== password) {
        return res
          .status(400)
          .send({ error: 'Invalid password '});
      }
  
      user.password = undefined;
  
      return res.send({
        user,
        auth: true,
        token: createToken({ user })
      });
    } catch (err) {
      return res
        .status(400)
        .send({ error: `${err}` });
    }
  };

  router.post('/authenticate', authenticateUser);

  return app.use('/auth', router)
};
