import crypto from 'node:crypto';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function authenticateDevice(req, deviceTokens) {
  const deviceKey = req.get('x-device-key');
  const providedToken = req.get('x-device-token');

  if (!deviceKey || !providedToken) {
    return { ok: false, status: 401, message: 'Missing device credentials' };
  }

  const expectedToken = deviceTokens[deviceKey];
  if (typeof expectedToken !== 'string' || !safeEqual(providedToken, expectedToken)) {
    return { ok: false, status: 401, message: 'Invalid device credentials' };
  }

  return { ok: true, deviceKey };
}
