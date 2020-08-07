const express = require('express');

const router = express.Router();

module.exports = ({ app, sharedSessions }) => {
  const shutdownServer = async (req, res) => {
    try {
      const { guid } = req.params;
      if (!guid) {
        return res.send({ shutdown: false, message: 'guid not found' });
      }

      const secret = process.env.SHUTDOWN_GUID;
      if (!secret) {
        return res.send({ shutdown: false, message: 'secret not found' });
      }

      const shouldServerDown = secret === guid;
      if (!shouldServerDown) {
        return res.send({ shutdown: false, message: 'invalid guid' });
      }

      const whatsappSessions = sharedSessions.getSessions();

      if (!whatsappSessions) {
        return res.send({ shutdown: true, message: 'no sessions found' });
      }

      console.log('[server] finalizando sessões');
      whatsappSessions.forEach((session) => {
        session.close();
      });

      console.log('[server] removendo sessões da memoria');
      sharedSessions.removeSessions();

      return res.send({ shutdown: true });
    } catch (err) {
      return res
        .status(400)
        .send({ error: `${err}`, shutdown: false });
    }
  };

  router.get('/shutdown/:guid', shutdownServer);

  return app.use('/server', router);
};
