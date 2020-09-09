const express = require('express');

const router = express.Router();
const ContactsRepository = require('../repositories/contactsRepository');
const ChatsRepository = require('../repositories/chatsRepository');

module.exports = ({ app, sharedSessions }) => {
  const addNewContact = async (req, res) => {
    const {
      name, phone,
      ownerId, userId,
    } = req.body;
    const sessionExists = sharedSessions.sessionExists(ownerId);

    if (!sessionExists) {
      return res.status(400).send({ error: 'session not exists' });
    }

    const whatsapp = sharedSessions.getSession(ownerId);
    try {
      const phoneJid = `${phone}@s.whatsapp.net`;
      const phoneExists = await whatsapp.isOnWhatsApp(phoneJid);

      if (!phoneExists) {
        return res.status(400).send({ error: 'phone not exists on whatsapp' });
      }

      const contactExists = await ContactsRepository.contactExists(phoneJid, ownerId);

      if (contactExists) {
        return res.status(400).send({ error: 'contact alredy exists' });
      }

      const contact = {
        jid: phoneJid,
        name,
        notify: name,
        ownerId,
        phone: `${countryCode}${phone}`,
        short: name,
        userId,
        active: true,
      };

      const contactId = await ContactsRepository.addContact(contact);

      await ChatsRepository.addChat({
        userId,
        ownerId,
        contactId,
      });

      const chat = await ChatsRepository.getChatByContactId(contactId);

      const createdContact = {
        id: contactId,
        ...contact,
      };

      return res.status(200).send({ contact: createdContact, chat });
    } catch (e) {
      return res
        .status(400)
        .send({ error: `${e}` });
    }
  };

  const finishContact = async (req, res) => {
    try {
      const { contactId, ownerId } = req.body;
      await ContactsRepository
        .updateByContactId(
          contactId, {
            userId: ownerId,
            active: false,
          },
        );

      await ChatsRepository
        .updateByContactId(
          contactId, {
            userId: ownerId,
          },
        );
      // await ChatsRepository.updateLastMessageByContactId(contactId);
      return res.status(200).send({ finish: true });
    } catch (e) {
      return res
        .status(400)
        .send({ error: `${e}` });
    }
  };

  const getProfilePicture = async (req, res) => {
    try {
      const { jid, contactId, ownerId } = req.body;

      const sessionExists = sharedSessions.sessionExists(ownerId);

      if (!sessionExists) {
        return res.status(400).send({ error: 'sessão não existe' });
      }

      const whatsappSession = sharedSessions.getSession(ownerId);

      if (whatsappSession.status !== 5) {
        return res.status(400).send({ error: 'sessão não está conectada' });
      }

      const [contactJid] = jid.split('@');
      const formatedJid = `${contactJid}@c.us`;
      const response = await whatsappSession.getProfilePicture(formatedJid);

      const { eurl } = response;
      await ContactsRepository
        .updateByContactId(
          contactId,
          { eurl },
        );

      return res.status(200).send({ eurl });
    } catch (e) {
      return res
        .status(400)
        .send({ error: `${e}` });
    }
  };

  router.post('/', addNewContact);
  router.post('/finish', finishContact);
  router.post('/picture', getProfilePicture);

  return app.use('/contact', router);
};
