import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { resolveVibeMasterKey } from '../auth/dev-secrets.js';

/**
 * KeyManager — Phase 6 Security Implementation
 * 
 * Provides encrypted storage for sensitive MCP and database credentials.
 * Uses AES-256-GCM for military-grade protection.
 */
class KeyManager {
  constructor() {
    this.storagePath = path.join(process.cwd(), 'data', 'security', 'vault.json');
    const masterKey = resolveVibeMasterKey();
    if (!masterKey) {
      throw new Error('FATAL SECURITY ERROR: VIBE_MASTER_KEY is required. Set it in Render Dashboard env vars or apply render.yaml with VIBE_MASTER_KEY generateValue; do not commit this secret.');
    }
    this.masterKey = masterKey;
    this.keys = new Map();
  }

  async init() {
    const dir = path.dirname(this.storagePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });

    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const decrypted = this.decrypt(JSON.parse(data));
      this.keys = new Map(Object.entries(JSON.parse(decrypted)));
    } catch (e) {
      console.log('[KeyManager] Initializing new vault');
      this.keys = new Map();
    }
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(64);
    const key = crypto.scryptSync(this.masterKey, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag,
      encrypted
    };
  }

  decrypt(data) {
    const key = crypto.scryptSync(this.masterKey, Buffer.from(data.salt, 'hex'), 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(data.iv, 'hex'));

    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async setKey(id, value) {
    this.keys.set(id, value);
    await this.save();
  }

  getKey(id) {
    return this.keys.get(id);
  }

  async save() {
    const plainText = JSON.stringify(Object.fromEntries(this.keys));
    const encryptedData = this.encrypt(plainText);
    await fs.writeFile(this.storagePath, JSON.stringify(encryptedData), { encoding: 'utf-8', mode: 0o600 });
  }
}

export const keyManager = new KeyManager();
await keyManager.init();
