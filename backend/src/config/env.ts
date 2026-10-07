import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (Neon PostgreSQL connection string)')
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL must be a PostgreSQL connection string, e.g. postgresql://user:pass@host/db?sslmode=require'
    ),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  CORS_ORIGIN: z.string().default('*'),
  PUBLIC_BASE_URL: z.string().url().optional().or(z.literal('')),
  OCR_PROVIDER: z.enum(['tesseract', 'google-vision']).default('tesseract'),
  GOOGLE_VISION_API_KEY: z.string().optional(),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid or missing environment variables:');
  for (const [key, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
    if (messages) console.error(`   - ${key}: ${messages.join(', ')}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === 'development';