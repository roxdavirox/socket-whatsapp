const jwt = require('jsonwebtoken');
const config = require('../../config.json');

// eslint-disable-next-line consistent-return
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) { 
    return res
      .status(401)
      .send({ error: 'No token provided' }); 
  }

  const schemeAndToken = authHeader.split(' ');

  if (schemeAndToken.length !== 2) { 
    return res
      .status(401)
      .send({ error: 'Token error' }); 
  }

  const [scheme, token] = schemeAndToken;

  if (!/^Bearer$/i.test(scheme)) { 
    return res
      .status(401)
      .send({ error: 'Invalid token' });
  }

  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: 'Invalid token' });
    }

    req.userId = decoded.id;

    return next();
  });
};
