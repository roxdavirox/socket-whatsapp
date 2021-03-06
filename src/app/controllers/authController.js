const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../../config.json');
const authMiddleware = require('../middlewares/auth');
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
      console.log('[controller-auth] autenticando email', email);
      const user = await userRepository.getUserByEmail(email);

      if (!user) {
        return res
          .status(400)
          .send({ error: 'User not found', auth: false });
      }

      // usar bcrypt
      // if (!await bcrypt.compare(password, user.password)) {
      if (user.password !== password) {
        return res
          .status(400)
          .send({ error: 'Invalid password ', auth: false });
      }
      console.log('[controller-auth] autenticado com sucesso!');
      user.password = undefined;

      return res.send({
        user,
        auth: true,
        token: createToken({ user })
      });
    } catch (err) {
      return res
        .status(400)
        .send({ error: `${err}`, auth: false });
    }
  };

  const validateUserToken = (req, res) => {
    const { token } = req;
    const newToken = createToken({ user: token.user });

    return res
      .status(200)
      .send({
        user: token.user,
        token: newToken,
        auth: true,
      });
  }

  router.post('/authenticate', authenticateUser);
  router.post('/validate', authMiddleware, validateUserToken);

  return app.use('/auth', router)
};
