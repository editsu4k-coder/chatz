import { Instagram, Facebook, Twitter, Send } from "lucide-react";

export type SocialKey = "instagram" | "facebook" | "twitter" | "telegram" | "whatsapp";

export const SOCIAL_META: Record<SocialKey, {
  label: string;
  brand: string;
  placeholder: string;
  hint: string;        // short how-to-get-link guide
  toUrl: (v: string) => string;
}> = {
  instagram: {
    label: "Instagram",
    brand: "#E1306C",
    placeholder: "@yourhandle",
    hint: "Open Instagram → tap your profile → the @handle at the top is your username.",
    toUrl: (v) => `https://instagram.com/${v.replace(/^@/, "")}`,
  },
  facebook: {
    label: "Facebook",
    brand: "#1877F2",
    placeholder: "your.username or full URL",
    hint: "Facebook → profile → tap your name to see the URL. The part after facebook.com/ is your username.",
    toUrl: (v) => (v.startsWith("http") ? v : `https://facebook.com/${v}`),
  },
  twitter: {
    label: "X / Twitter",
    brand: "#000000",
    placeholder: "@yourhandle",
    hint: "Open X → tap your avatar → your @handle is shown under your name.",
    toUrl: (v) => `https://x.com/${v.replace(/^@/, "")}`,
  },
  telegram: {
    label: "Telegram",
    brand: "#229ED9",
    placeholder: "@yourhandle or t.me link",
    hint: "Telegram → Settings → Username → your @handle is shown there.",
    toUrl: (v) => (v.startsWith("http") ? v : `https://t.me/${v.replace(/^@/, "")}`),
  },
  whatsapp: {
    label: "WhatsApp",
    brand: "#25D366",
    placeholder: "+1 555 123 4567",
    hint: "Use your full phone number with country code. We turn it into a wa.me chat link.",
    toUrl: (v) => `https://wa.me/${v.replace(/[^\d]/g, "")}`,
  },
};

export const SOCIAL_ORDER: SocialKey[] = ["instagram", "facebook", "twitter", "telegram", "whatsapp"];

export function SocialIcon({ k, size = 18, className = "" }: { k: SocialKey; size?: number; className?: string }) {
  if (k === "instagram") return <Instagram size={size} className={className} />;
  if (k === "facebook") return <Facebook size={size} className={className} />;
  if (k === "twitter") return <XLogo size={size} className={className} />;
  if (k === "telegram") return <Send size={size} className={className} />;
  return <WhatsAppLogo size={size} className={className} />;
}

function XLogo({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2H21.5l-7.43 8.49L22.5 22h-6.79l-5.31-6.93L4.41 22H1.15l7.95-9.08L1.5 2h6.92l4.8 6.34L18.244 2zm-1.19 18h1.88L7.04 4h-2L17.054 20z" />
    </svg>
  );
}

function WhatsAppLogo({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36A9.95 9.95 0 0012.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm5.84 14.13c-.25.7-1.44 1.34-1.99 1.39-.52.05-1.18.07-1.9-.12-.44-.13-1-.32-1.72-.63-3.03-1.31-5.01-4.38-5.16-4.58-.15-.2-1.23-1.63-1.23-3.12 0-1.48.78-2.21 1.05-2.51.27-.3.59-.37.78-.37.2 0 .39 0 .56.01.18.01.42-.07.66.5.25.6.83 2.08.9 2.23.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.39-.46.52-.15.15-.31.31-.13.61.17.3.78 1.29 1.67 2.09 1.15 1.03 2.12 1.35 2.42 1.5.3.15.48.13.66-.08.18-.2.76-.89.96-1.19.2-.3.4-.25.67-.15.27.1 1.7.8 1.99.95.3.15.48.22.55.34.07.13.07.74-.18 1.44z" />
    </svg>
  );
}
