import jwt from 'jsonwebtoken';
import { getUserById } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

/**
 * Generate a JWT for a user
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Express middleware: Verify JWT and attach user to req
 */
export async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Verify a JWT and return the decoded payload (for WebSocket auth)
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function parseCookies(header = '') {
  try {
    return Object.fromEntries(
      header
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
          const index = part.indexOf('=');
          if (index === -1) return [part, ''];
          return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
        })
    );
  } catch {
    return {};
  }
}

function readToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.split(' ')[1];
  return parseCookies(req.headers.cookie).selina_token;
}
