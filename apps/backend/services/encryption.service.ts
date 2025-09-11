import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  authTag: string;
  algorithm: string;
  keyDerivation: string;
  iterations: number;
}

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyDerivation = 'scrypt';
  private iterations = 32768; // Recommended iterations for scrypt
  private keyLength = 32; // 256 bits
  private saltLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  
  // Master key from environment (should be from Azure Key Vault in production)
  private masterKey: string;

  constructor() {
    // In production, this should come from Azure Key Vault
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY || '';
    
    if (!this.masterKey) {
      console.warn('ENCRYPTION_MASTER_KEY not set - using fallback (INSECURE!)');
      // Generate a temporary key for development only
      this.masterKey = crypto.randomBytes(32).toString('hex');
    }
  }

  /**
   * Derive a key from the master key and salt using scrypt
   */
  private async deriveKey(salt: Buffer): Promise<Buffer> {
    const key = await scrypt(this.masterKey, salt, this.keyLength) as Buffer;
    return key;
  }

  /**
   * Encrypt data with random salt and IV
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    try {
      // Generate random salt and IV for this encryption
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);

      // Derive key from master key and salt
      const key = await this.deriveKey(salt);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag for GCM mode
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm,
        keyDerivation: this.keyDerivation,
        iterations: this.iterations,
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using the stored salt and IV
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      // Validate algorithm
      if (encryptedData.algorithm !== this.algorithm) {
        throw new Error('Unsupported encryption algorithm');
      }

      // Convert hex strings back to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');

      // Derive the same key using the stored salt
      const key = await this.deriveKey(salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt sensitive data as a JSON string for storage
   */
  async encryptJson(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    const encrypted = await this.encrypt(jsonString);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt JSON data
   */
  async decryptJson<T = any>(encryptedString: string): Promise<T> {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const decrypted = await this.decrypt(encryptedData);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Hash a password using bcrypt-like functionality with crypto
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    return salt.toString('hex') + ':' + derivedKey.toString('hex');
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [saltHex, keyHex] = hash.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    return derivedKey.toString('hex') === keyHex;
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a cryptographically secure OTP
   */
  generateOTP(length: number = 6): string {
    const max = Math.pow(10, length);
    const min = Math.pow(10, length - 1);
    const range = max - min;
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    const otp = min + (randomNumber % range);
    return otp.toString().padStart(length, '0');
  }

  /**
   * Create a time-limited token
   */
  createTimeLimitedToken(data: any, expiresInMs: number = 3600000): string {
    const expiry = Date.now() + expiresInMs;
    const payload = {
      data,
      expiry,
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    
    const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.masterKey)
      .update(token)
      .digest('hex');
    
    return `${token}.${signature}`;
  }

  /**
   * Verify a time-limited token
   */
  verifyTimeLimitedToken<T = any>(token: string): T | null {
    try {
      const [payload, signature] = token.split('.');
      
      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.masterKey)
        .update(payload)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return null;
      }
      
      // Decode and check expiry
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      
      if (decoded.expiry < Date.now()) {
        return null;
      }
      
      return decoded.data as T;
    } catch {
      return null;
    }
  }

  /**
   * Rotate encryption keys (for key rotation strategy)
   */
  async rotateKey(oldEncryptedData: EncryptedData, newMasterKey: string): Promise<EncryptedData> {
    // Decrypt with old key
    const plaintext = await this.decrypt(oldEncryptedData);
    
    // Temporarily set new master key
    const oldKey = this.masterKey;
    this.masterKey = newMasterKey;
    
    // Encrypt with new key
    const newEncryptedData = await this.encrypt(plaintext);
    
    // Restore old key (in production, this would be handled differently)
    this.masterKey = oldKey;
    
    return newEncryptedData;
  }
}

export const encryptionService = new EncryptionService();