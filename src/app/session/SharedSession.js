class SharedSession {
  constructor() {
    this.sessions = {};
  }

  createSession(session, id) {
    this.sessions[id] = session;
    return session;
  }

  getSession(id) {
    return this.sessions[id] || false;
  }

  getSessions() {
    if (!this.sessions) return;
    // eslint-disable-next-line consistent-return
    return Object
      .values(this.sessions);
  }

  sessionExists(id) {
    return this.sessions[id] !== undefined;
  }

  removeSession(id) {
    if (!this.sessionExists(id)) return;
    delete this.sessions[id];
  }

  removeSessions() {
    const sessionsIds = Object.keys(this.sessions);
    sessionsIds.forEach((id) => this.removeSession(id));
  }
}

module.exports = SharedSession;
