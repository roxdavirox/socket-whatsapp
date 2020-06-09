const jwt = require('jsonwebtoken');
const config = require('../../config.json');

// eslint-disable-next-line consistent-return
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res
      .status(401)
      .send({ error: 'No token provided', auth: false });
  }

  const schemeAndToken = authHeader.split(' ');

  if (schemeAndToken.length !== 2) {
    return res
      .status(401)
      .send({ error: 'Token error', auth: false });
  }

  const [scheme, token] = schemeAndToken;

  if (!scheme.includes('Bearer')) {
    return res
      .status(401)
      .send({ error: 'Invalid token', auth: false });
  }

  const { secret } = config.jwt;
  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: 'Invalid token ' + err, auth: false });
    }

    req.token = decoded;

    return next();
  });
};
