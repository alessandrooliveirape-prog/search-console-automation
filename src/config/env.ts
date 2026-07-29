import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().min(1),
  GOOGLE_REFRESH_TOKEN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  // Integrações opcionais
  CALLMEBOT_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  // GA4 Property IDs por site (formato: "properties/123456789")
  GA4_PROPERTY_EMPREGAPE: z.string().optional(),
  GA4_PROPERTY_BRASILCALCULADORAS: z.string().optional(),
  GA4_PROPERTY_MESTREDAFEDERAL: z.string().optional(),
  GA4_PROPERTY_TOOLBRASIL: z.string().optional(),
  // GA4 Service Account (alternativa ao OAuth — usada pelo Emprega PE)
  GA4_CLIENT_EMAIL: z.string().optional(),
  GA4_PRIVATE_KEY: z.string().optional(),
  // PageSpeed Insights API Key (opcional — a API funciona sem key com quota menor)
  PAGESPEED_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
