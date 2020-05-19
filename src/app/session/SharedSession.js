class SharedSession {
  constructor() {
    this.sessions = {};
  }

  setSession(session, id) {
    this.sessions[id] = session;
    return session;
  }

  getSession(id) {
    if (!this.sessionExists(id)) return;
    return this.sessions[id];
  }

  sessionExists(id) {
    return this.sessions[id] !== undefined;
  }

  removeSession(id) {
    if (!this.sessionExists(id)) return;
    const session = this.sessions[id];
    delete this.sessions[id];
    return session;
  }

}

module.exports = SharedSession;