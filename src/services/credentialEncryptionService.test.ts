import { CredentialEncryptionService } from './credentialEncryptionService';

describe('CredentialEncryptionService', () => {
  let service: CredentialEncryptionService;
  const testPassword = 'test-password-with-sufficient-length-for-security';
  const testData = 'sensitive-ssh-key-data-12345';

  beforeEach(() => {
    service = new CredentialEncryptionService();
    // Set test encryption key
    process.env.CREDENTIAL_ENCRYPTION_KEY = testPassword;
  });

  afterEach(() => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data successfully', () => {
      const encrypted = service.encrypt(testData, testPassword);
      const decrypted = service.decrypt(encrypted, testPassword);

      expect(decrypted).toBe(testData);
      expect(encrypted).not.toBe(testData);
    });

    it('should produce different encrypted output each time', () => {
      const encrypted1 = service.encrypt(testData, testPassword);
      const encrypted2 = service.encrypt(testData, testPassword);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(service.decrypt(encrypted1, testPassword)).toBe(testData);
      expect(service.decrypt(encrypted2, testPassword)).toBe(testData);
    });

    it('should fail to decrypt with wrong password', () => {
      const encrypted = service.encrypt(testData, testPassword);

      expect(() => {
        service.decrypt(encrypted, 'wrong-password');
      }).toThrow();
    });

    it('should fail to decrypt tampered data', () => {
      const encrypted = service.encrypt(testData, testPassword);

      // Tamper with the encrypted data
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] ^= 0xFF; // Flip bits in last byte
      const tampered = buffer.toString('base64');

      expect(() => {
        service.decrypt(tampered, testPassword);
      }).toThrow();
    });

    it('should handle empty strings', () => {
      const encrypted = service.encrypt('', testPassword);
      const decrypted = service.decrypt(encrypted, testPassword);

      expect(decrypted).toBe('');
    });

    it('should handle long strings', () => {
      const longString = 'a'.repeat(10000);
      const encrypted = service.encrypt(longString, testPassword);
      const decrypted = service.decrypt(encrypted, testPassword);

      expect(decrypted).toBe(longString);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./\n\t\r';
      const encrypted = service.encrypt(specialChars, testPassword);
      const decrypted = service.decrypt(encrypted, testPassword);

      expect(decrypted).toBe(specialChars);
    });

    it('should handle unicode characters', () => {
      const unicode = '你好世界 🚀 émoji café';
      const encrypted = service.encrypt(unicode, testPassword);
      const decrypted = service.decrypt(encrypted, testPassword);

      expect(decrypted).toBe(unicode);
    });
  });

  describe('encryptCredential and decryptCredential', () => {
    it('should use environment variable for encryption', () => {
      const encrypted = service.encryptCredential(testData);
      const decrypted = service.decryptCredential(encrypted);

      expect(decrypted).toBe(testData);
    });

    it('should throw error if CREDENTIAL_ENCRYPTION_KEY is not set', () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;

      expect(() => {
        service.encryptCredential(testData);
      }).toThrow('CREDENTIAL_ENCRYPTION_KEY environment variable is not set');
    });
  });

  describe('isConfigured', () => {
    it('should return true when encryption key is set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when encryption key is not set', () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('security properties', () => {
    it('should use authenticated encryption (auth tag)', () => {
      const encrypted = service.encrypt(testData, testPassword);
      const buffer = Buffer.from(encrypted, 'base64');

      // Should have salt (32) + iv (16) + authTag (16) + encrypted data
      expect(buffer.length).toBeGreaterThan(32 + 16 + 16);
    });

    it('should use unique IV for each encryption', () => {
      const encrypted1 = service.encrypt(testData, testPassword);
      const encrypted2 = service.encrypt(testData, testPassword);

      const buffer1 = Buffer.from(encrypted1, 'base64');
      const buffer2 = Buffer.from(encrypted2, 'base64');

      // Extract IVs (after salt)
      const iv1 = buffer1.subarray(32, 32 + 16);
      const iv2 = buffer2.subarray(32, 32 + 16);

      expect(iv1.equals(iv2)).toBe(false);
    });

    it('should use unique salt for each encryption', () => {
      const encrypted1 = service.encrypt(testData, testPassword);
      const encrypted2 = service.encrypt(testData, testPassword);

      const buffer1 = Buffer.from(encrypted1, 'base64');
      const buffer2 = Buffer.from(encrypted2, 'base64');

      // Extract salts (first 32 bytes)
      const salt1 = buffer1.subarray(0, 32);
      const salt2 = buffer2.subarray(0, 32);

      expect(salt1.equals(salt2)).toBe(false);
    });
  });
});
