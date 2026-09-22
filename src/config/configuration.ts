export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  clientUrl: string;
  database: {
    url: string;
  };
  auth: {
    secret: string;
    url: string;
  };
  storage: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  auth: {
    secret: process.env.BETTER_AUTH_SECRET || 'dev_secret_key_rizex_1234567890',
    url: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  },
  storage: {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'rizex-storage',
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
  },
});
