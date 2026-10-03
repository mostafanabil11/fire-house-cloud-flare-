import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvConfig } from './env.validation';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService<EnvConfig>) {}

  get<T = any>(key: keyof EnvConfig): T | undefined {
    return this.configService.get<T>(key);
  }

  get mongodbUri(): string {
    return this.configService.get<string>('MONGODB_URI')!;
  }

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET')!;
  }

  get jwtExpiration(): string {
    return this.configService.get<string>('JWT_EXPIRATION')!;
  }

  get jwtRefreshExpiration(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRATION')!;
  }

  get port(): number {
    return this.configService.get<number>('PORT')!;
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV')!;
  }

  // The canonical site URL — used wherever a single address is needed, such as
  // the post-OAuth redirect.
  get frontendUrl(): string {
    return this.frontendUrls[0];
  }

  // FRONTEND_URL may hold several comma-separated origins, because a deployed
  // site legitimately has more than one: the production domain, a custom
  // domain, and per-branch preview URLs. All of them need to pass
  // CORS. The first entry is treated as canonical.
  get frontendUrls(): string[] {
    return this.configService
      .get<string>('FRONTEND_URL')!
      .split(',')
      .map(url => url.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }

  get proxySecret(): string | undefined {
    return this.configService.get<string>('PROXY_SECRET');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  // Preferred transport in production: an HTTPS API, which hosts that block
  // outbound SMTP ports cannot block. Render's free instances refuse traffic on
  // 25, 465 and 587, so SMTP works in development and silently does nothing
  // once deployed.
  get brevoApiKey(): string | undefined {
    return this.get<string>('BREVO_API_KEY')?.trim() || undefined;
  }

  // Gmail over SMTP — kept for local development, where nothing is blocked.
  get isSmtpConfigured(): boolean {
    return Boolean(this.get('EMAIL_USER') && this.get('EMAIL_PASSWORD'));
  }

  // Order confirmations, OTPs and password resets all go through one of the
  // two. Without either the app still runs — orders are placed, accounts still
  // work — but nothing is delivered, so this is checked explicitly rather than
  // left to fail per message.
  get isEmailConfigured(): boolean {
    return Boolean(this.brevoApiKey) || this.isSmtpConfigured;
  }

  // The address customers see. Must be one the provider has verified —
  // with Brevo that can be a single confirmed address rather than a whole
  // domain, which is what makes this workable before a brand domain exists.
  get mailFromAddress(): string {
    return (this.get<string>('MAIL_FROM_ADDRESS') || this.get<string>('EMAIL_USER') || '')?.trim();
  }

  get mailFromName(): string {
    return this.get<string>('MAIL_FROM_NAME')?.trim() || 'Fire House';
  }

  // Prefixes the human-readable order number. Configurable because it is
  // brand-facing: the restaurant reads it out on the phone, and it was still
  // carrying the initials of the storefront this project was built from.
  get orderNumberPrefix(): string {
    return this.get<string>('ORDER_NUMBER_PREFIX')?.trim().toUpperCase() || 'FH';
  }

  // Google sign-in is optional, exactly like Paymob card payments: all three
  // values or none. Passport's OAuth2 strategy throws from its constructor if
  // clientID is missing, so a half-configured deployment doesn't degrade to
  // "Google button doesn't work" — it takes the whole process down at boot.
  get isGoogleAuthConfigured(): boolean {
    return Boolean(
      this.get('GOOGLE_CLIENT_ID') &&
      this.get('GOOGLE_CLIENT_SECRET') &&
      this.get('GOOGLE_CALLBACK_URL')
    );
  }

  // --- WhatsApp order alerts (Meta Cloud API) ---
  //
  // All-or-nothing, like Paymob and Google sign-in: without a token, a phone
  // number id and at least one recipient there is nothing to send or nobody to
  // send it to. Unconfigured is a supported state — alerts are recorded as
  // 'skipped' with their full text, so the restaurant can read what its team
  // would have received while Meta onboarding is still in progress.
  get isWhatsAppConfigured(): boolean {
    return Boolean(
      this.get('WHATSAPP_ACCESS_TOKEN') &&
      this.get('WHATSAPP_PHONE_NUMBER_ID') &&
      this.get('WHATSAPP_RECIPIENTS')
    );
  }

  get whatsappAccessToken(): string {
    return this.get<string>('WHATSAPP_ACCESS_TOKEN')?.trim() ?? '';
  }

  get whatsappPhoneNumberId(): string {
    return this.get<string>('WHATSAPP_PHONE_NUMBER_ID')?.trim() ?? '';
  }

  // Comma-separated staff/owner numbers. Meta's Cloud API sends to individual
  // recipients, so this is a list of people — not a WhatsApp group.
  get whatsappRecipients(): string {
    return this.get<string>('WHATSAPP_RECIPIENTS')?.trim() ?? '';
  }

  // Empty means "send plain text", which only works inside the 24-hour window
  // opened by the recipient messaging the business. Set this to the approved
  // template's name for production.
  get whatsappTemplateName(): string {
    return this.get<string>('WHATSAPP_TEMPLATE_NAME')?.trim() ?? '';
  }

  get whatsappTemplateLanguage(): string {
    return this.get<string>('WHATSAPP_TEMPLATE_LANGUAGE')?.trim() || 'en';
  }

  // Echoed back to Meta during webhook verification, and used to reject
  // status callbacks that did not come from them.
  get whatsappWebhookVerifyToken(): string {
    return this.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN')?.trim() ?? '';
  }

  get paymobApiKey(): string {
    return this.configService.get<string>('PAYMOB_API_KEY')!;
  }

  get paymobIntegrationId(): string {
    return this.configService.get<string>('PAYMOB_INTEGRATION_ID')!;
  }

  get paymobIframeId(): string {
    return this.configService.get<string>('PAYMOB_IFRAME_ID')!;
  }

  get paymobHmacSecret(): string {
    return this.configService.get<string>('PAYMOB_HMAC_SECRET')!;
  }
}
