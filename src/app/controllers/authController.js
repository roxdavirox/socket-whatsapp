const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../../config.json');

const User = require('../models/user');

const router = express.Router();

const createToken = (params = {}) => jwt.sign(params, config.jwt.secret, {
  expiresIn: 86400.0,
});
// TODO: substituir mongodb por rethinkdb queries - usar repositories
const registerNewUser = async (req, res) => {
  const { email } = req.body;

  try {
    if (await User.findOne({ email })) {
      return res.status(400).send({ error: 'Usuário já existe' });
    }

    const user = await User.create(req.body);

    user.password = undefined;

    return res.send({ user, auth: true, token: createToken({ id: user.id }) });
  } catch (err) {
    return res.status(400).send({
      error: 'Registration fail',
    });
  }
};

const authenticateUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) { return res.status(400).send({ error: 'User not found' }); }

    if (!await bcrypt.compare(password, user.password)) {
      return res.status(400)
        .send({ error: 'Invalid password' });
    }

    user.password = undefined;

    return res.send({ user, auth: true, token: createToken({ user }) });
  } catch (err) {
    return res.status(400).send({ error: `Error ${err}` });
  }
};

router.post('/register', registerNewUser);
router.post('/authenticate', authenticateUser);

module.exports = (app) => app.use('/auth', router);
