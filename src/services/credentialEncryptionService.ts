import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Service for encrypting and decrypting sensitive credentials
 * Uses AES-256-GCM for encryption
 */
export class CredentialEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly saltLength = 32;

  /**
   * Encrypt sensitive data
   * @param plaintext The data to encrypt
   * @param password The encryption password (from environment variable)
   * @returns Base64-encoded encrypted data with salt, IV, and auth tag
   */
  encrypt(plaintext: string, password: string): string {
    // Generate random salt and IV
    const salt = randomBytes(this.saltLength);
    const iv = randomBytes(this.ivLength);

    // Derive key from password
    const key = scryptSync(password, salt, this.keyLength);

    // Create cipher
    const cipher = createCipheriv(this.algorithm, key, iv);

    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine salt, iv, authTag, and encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex'),
    ]);

    // Return as base64
    return combined.toString('base64');
  }

  /**
   * Decrypt sensitive data
   * @param encryptedData Base64-encoded encrypted data
   * @param password The decryption password (from environment variable)
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: string, password: string): string {
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = combined.subarray(0, this.saltLength);
    const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
    const authTag = combined.subarray(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.authTagLength
    );
    const encrypted = combined.subarray(this.saltLength + this.ivLength + this.authTagLength);

    // Derive key from password
    const key = scryptSync(password, salt, this.keyLength);

    // Create decipher
    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get encryption password from environment
   */
  private getEncryptionPassword(): string {
    const password = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!password) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is not set');
    }
    return password;
  }

  /**
   * Encrypt credentials for storage
   */
  encryptCredential(plaintext: string): string {
    return this.encrypt(plaintext, this.getEncryptionPassword());
  }

  /**
   * Decrypt credentials from storage
   */
  decryptCredential(encryptedData: string): string {
    return this.decrypt(encryptedData, this.getEncryptionPassword());
  }

  /**
   * Check if encryption is properly configured
   */
  isConfigured(): boolean {
    try {
      return !!process.env.CREDENTIAL_ENCRYPTION_KEY;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const credentialEncryptionService = new CredentialEncryptionService();
