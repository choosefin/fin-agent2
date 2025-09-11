import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import crypto from 'crypto';

interface SecretMetadata {
  name: string;
  version?: string;
  expiresOn?: Date;
  createdOn?: Date;
  updatedOn?: Date;
  tags?: Record<string, string>;
}

export class SecretsService {
  private client: SecretClient | null = null;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private keyVaultName: string;
  private isProduction: boolean;
  
  // Fallback for local development
  private localSecrets: Map<string, string> = new Map();

  constructor() {
    this.keyVaultName = process.env.AZURE_KEY_VAULT_NAME || '';
    this.isProduction = process.env.NODE_ENV === 'production';

    if (this.keyVaultName && this.isProduction) {
      this.initializeKeyVault();
    } else {
      this.initializeLocalSecrets();
    }
  }

  /**
   * Initialize Azure Key Vault client
   */
  private initializeKeyVault() {
    try {
      const vaultUrl = `https://${this.keyVaultName}.vault.azure.net`;
      const credential = new DefaultAzureCredential();
      this.client = new SecretClient(vaultUrl, credential);
      console.log('Azure Key Vault initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Azure Key Vault:', error.message);
      // Fall back to local secrets in case of error
      this.initializeLocalSecrets();
    }
  }

  /**
   * Initialize local secrets for development
   */
  private initializeLocalSecrets() {
    console.warn('Using local secrets storage (development mode)');
    
    // Load secrets from environment variables
    const secretKeys = [
      'SUPABASE_SERVICE_KEY',
      'PLAID_SECRET',
      'ALPACA_SECRET_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GROQ_API_KEY',
      'MEM0_API_KEY',
      'ENCRYPTION_MASTER_KEY',
    ];

    secretKeys.forEach(key => {
      const value = process.env[key];
      if (value) {
        this.localSecrets.set(key, value);
      }
    });
  }

  /**
   * Get a secret from Key Vault or local storage
   */
  async getSecret(name: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      let value: string | null = null;

      if (this.client) {
        // Get from Azure Key Vault
        const secret = await this.client.getSecret(name);
        value = secret.value || null;
      } else {
        // Get from local storage
        value = this.localSecrets.get(name) || null;
      }

      if (value) {
        // Cache the secret
        this.cache.set(name, {
          value,
          expiresAt: Date.now() + this.cacheTimeout,
        });
      }

      return value;
    } catch (error) {
      console.error(`Failed to get secret ${name}:`, error.message);
      return null;
    }
  }

  /**
   * Set a secret in Key Vault or local storage
   */
  async setSecret(name: string, value: string, metadata?: Partial<SecretMetadata>): Promise<void> {
    try {
      if (this.client) {
        // Set in Azure Key Vault
        await this.client.setSecret(name, value, {
          expiresOn: metadata?.expiresOn,
          tags: metadata?.tags,
        });
      } else {
        // Set in local storage
        this.localSecrets.set(name, value);
      }

      // Update cache
      this.cache.set(name, {
        value,
        expiresAt: Date.now() + this.cacheTimeout,
      });
    } catch (error) {
      throw new Error(`Failed to set secret ${name}: ${error.message}`);
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(name: string): Promise<void> {
    try {
      if (this.client) {
        // Delete from Azure Key Vault (soft delete)
        const deletePoller = await this.client.beginDeleteSecret(name);
        await deletePoller.pollUntilDone();
      } else {
        // Delete from local storage
        this.localSecrets.delete(name);
      }

      // Remove from cache
      this.cache.delete(name);
    } catch (error) {
      throw new Error(`Failed to delete secret ${name}: ${error.message}`);
    }
  }

  /**
   * List all secrets
   */
  async listSecrets(): Promise<SecretMetadata[]> {
    try {
      const secrets: SecretMetadata[] = [];

      if (this.client) {
        // List from Azure Key Vault
        for await (const secretProperties of this.client.listPropertiesOfSecrets()) {
          secrets.push({
            name: secretProperties.name,
            version: secretProperties.version,
            expiresOn: secretProperties.expiresOn,
            createdOn: secretProperties.createdOn,
            updatedOn: secretProperties.updatedOn,
            tags: secretProperties.tags,
          });
        }
      } else {
        // List from local storage
        for (const name of this.localSecrets.keys()) {
          secrets.push({ name });
        }
      }

      return secrets;
    } catch (error) {
      throw new Error(`Failed to list secrets: ${error.message}`);
    }
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(name: string): Promise<string> {
    try {
      // Generate new secret value
      const newValue = crypto.randomBytes(32).toString('hex');

      // Get the old secret for backup
      const oldValue = await this.getSecret(name);

      // Set the new secret with version tag
      await this.setSecret(name, newValue, {
        tags: {
          rotatedAt: new Date().toISOString(),
          previousVersion: oldValue ? 'backed-up' : 'none',
        },
      });

      // If there was an old value, back it up
      if (oldValue) {
        await this.setSecret(`${name}-backup-${Date.now()}`, oldValue, {
          tags: { type: 'backup', originalSecret: name },
        });
      }

      return newValue;
    } catch (error) {
      throw new Error(`Failed to rotate secret ${name}: ${error.message}`);
    }
  }

  /**
   * Get multiple secrets at once
   */
  async getSecrets(names: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};

    await Promise.all(
      names.map(async (name) => {
        results[name] = await this.getSecret(name);
      })
    );

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get database connection string with secrets replaced
   */
  async getDatabaseConnectionString(): Promise<string> {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'app';
    const dbUser = process.env.DB_USER || 'postgres';
    
    // Get password from secure storage
    const dbPassword = await this.getSecret('DB_PASSWORD') || 'postgres';

    return `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
  }

  /**
   * Get Redis connection string with secrets replaced
   */
  async getRedisConnectionString(): Promise<string> {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || '6379';
    
    // Get password from secure storage if Redis requires auth
    const redisPassword = await this.getSecret('REDIS_PASSWORD');

    if (redisPassword) {
      return `redis://:${redisPassword}@${redisHost}:${redisPort}`;
    }

    return `redis://${redisHost}:${redisPort}`;
  }

  /**
   * Initialize required secrets if they don't exist
   */
  async initializeRequiredSecrets(): Promise<void> {
    const requiredSecrets = [
      'ENCRYPTION_MASTER_KEY',
      'JWT_SECRET',
      'API_SIGNING_KEY',
    ];

    for (const secretName of requiredSecrets) {
      const existing = await this.getSecret(secretName);
      if (!existing) {
        const newSecret = crypto.randomBytes(32).toString('hex');
        await this.setSecret(secretName, newSecret, {
          tags: { type: 'auto-generated', purpose: 'security' },
        });
        console.log(`Initialized secret: ${secretName}`);
      }
    }
  }
}

export const secretsService = new SecretsService();