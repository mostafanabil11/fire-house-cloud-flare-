import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3100').transform(Number),
  // Not z.url(): a replica-set connection string lists several hosts
  // separated by commas, which is valid Mongo syntax but not a parseable URL,
  // and rejecting it would refuse to boot against a perfectly good cluster.
  // The scheme is the part actually worth checking.
  MONGODB_URI: z
    .string()
    .refine(
      (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
      'MONGODB_URI must start with mongodb:// or mongodb+srv://',
    ),

  // One or more site origins, comma-separated — a deployed site has several
  // (production, custom domain, per-branch previews) and all of them need to
  // pass CORS. Validated per entry so one malformed origin is caught here at
  // boot rather than as a confusing CORS failure in the browser later.
  FRONTEND_URL: z
    .string()
    .default('http://localhost:3101')
    .refine(
      (value) =>
        value
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean)
          .every((url) => URL.canParse(url)),
      'FRONTEND_URL must be a URL, or several comma-separated URLs',
    ),
  
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters — generate one with `openssl rand -base64 48`'),

  // Shared with the site's Cloudflare Worker, which proxies browser traffic
  // here — it is what lets the Worker vouch for each customer's real address.
  // See proxy-client-ip.middleware.ts. Optional: without it every customer
  // shares one rate-limit allowance, which works until the site gets busy.
  PROXY_SECRET: z
    .string()
    .min(32, 'PROXY_SECRET must be at least 32 characters — generate one with `openssl rand -base64 48`')
    .optional(),
  JWT_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  
  // Email transport — Brevo's HTTP API is preferred where SMTP ports are
  // blocked (most managed hosts); Gmail over SMTP stays for local development.
  // All optional: the app runs without email, it just delivers nothing.
  BREVO_API_KEY: z.string().optional(),
  MAIL_FROM_ADDRESS: z.email().optional(),
  MAIL_FROM_NAME: z.string().optional(),
  ORDER_NUMBER_PREFIX: z
    .string()
    .regex(/^[A-Za-z0-9]{2,6}$/, 'ORDER_NUMBER_PREFIX must be 2-6 letters or digits')
    .optional(),

  EMAIL_USER: z.email().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  
  // WhatsApp order alerts. Optional as a group — see isWhatsAppConfigured.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_RECIPIENTS: z.string().optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  
  OTP_EXPIRATION_MINUTES: z.string().default('10').transform(Number),
  MAX_LOGIN_ATTEMPTS: z.string().default('5').transform(Number),
  LOCK_TIME_MINUTES: z.string().default('15').transform(Number),
  
  PAYMOB_API_KEY: z.string().optional(),
  PAYMOB_INTEGRATION_ID: z.string().optional(),
  PAYMOB_IFRAME_ID: z.string().optional(),
  PAYMOB_HMAC_SECRET: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  // A variable that exists but holds an empty string is not a configured
  // variable — it is an unfilled one. Render's blueprint creates every key it
  // declares, including the ones left blank in the dashboard, so `optional()`
  // alone is not enough: the key is present, '' reaches the schema, and a
  // format check like MAIL_FROM_ADDRESS's rejects it. The service then refuses
  // to boot over an unused email sender, which is the opposite of optional.
  //
  // Dropping blanks here makes absent and blank mean the same thing, for every
  // field, rather than each optional field having to defend itself.
  const present = Object.fromEntries(
    Object.entries(config).filter(
      ([, value]) => typeof value !== 'string' || value.trim() !== '',
    ),
  );

  const result = envSchema.safeParse(present);

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }

  return result.data;
}
