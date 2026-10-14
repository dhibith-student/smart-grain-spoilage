import crypto from 'node:crypto';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function readBearerToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export function createDashboardAuth({ username, password, sessionTtlMs = 8 * 60 * 60 * 1000 }) {
  const sessions = new Map();

  const purgeExpired = () => {
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
  };

  const issue = () => {
    purgeExpired();
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { username, expiresAt: Date.now() + sessionTtlMs });
    return token;
  };

  const getSession = (req) => {
    purgeExpired();
    const token = readBearerToken(req);
    if (!token) return null;
    const session = sessions.get(token);
    return session ? { ...session, token } : null;
  };

  return {
    login(candidateUsername, candidatePassword) {
      if (!safeEqual(candidateUsername, username) || !safeEqual(candidatePassword, password)) {
        return null;
      }
      return issue();
    },
    logout(req) {
      const token = readBearerToken(req);
      if (token) sessions.delete(token);
    },
    middleware(req, res, next) {
      const session = getSession(req);
      if (!session) return res.status(401).json({ error: 'Dashboard authentication required' });
      req.dashboardSession = session;
      return next();
    },
    sessionInfo(req) {
      const session = getSession(req);
      return session ? { username: session.username, expires_at: new Date(session.expiresAt).toISOString() } : null;
    }
  };
}
