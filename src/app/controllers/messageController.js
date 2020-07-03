/* eslint-disable no-underscore-dangle */
const express = require('express');

const router = express.Router();
const MessagesRepository = require('../repositories/messagesRepository');
const authMiddleware = require('../middlewares/auth');

module.exports = ({ app, sharedSessions }) => {
  const getMessagesBetween = async (req, res) => {
    const {
      contactId,
    } = req.params;
    const { start = 0, end = 15 } = req.query;

    const _start = Number(start);
    const _end = Number(end);

    try {
      const messageCount = await MessagesRepository.getMessagesCountByContactId(contactId);
      const messages = await MessagesRepository
        .getMessagesBetween(contactId, _start, _end);

      const startNewPagination = _end < messageCount
        ? _end
        : messageCount;
      const endNewPagination = _end + 15 < messageCount
        ? startNewPagination + 15
        : startNewPagination + messageCount - _end;
      const hasMoreMessage = _end < messageCount;
      return res
        .status(200)
        .send({
          messages,
          messageCount,
          nextPagination: {
            start: startNewPagination,
            end: endNewPagination,
          },
          hasMoreMessage,
        });
    } catch (e) {
      return res
        .status(400)
        .send({ error: `${e}` });
    }
  };

  router.get('/:contactId', authMiddleware, getMessagesBetween);

  return app.use('/messages', router);
};
