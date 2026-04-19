import { Building2, MessageCircle, MessagesSquare, Megaphone, Pin, Sparkles, Users, Video } from "lucide-react";

export const SOCIAL_PLATFORM_CONFIGS = [
  { key: "facebook", label: "Facebook", icon: Users, hint: "Profile + Pages" },
  { key: "instagram", label: "Instagram", icon: Sparkles, hint: "Professional account only" },
  { key: "threads", label: "Threads", icon: MessageCircle, hint: "Threads profile publishing" },
  { key: "linkedin", label: "LinkedIn", icon: Megaphone, hint: "Profile + organizations/pages by access" },
  { key: "youtube", label: "YouTube", icon: Video, hint: "Channel publishing and analytics" },
  { key: "x", label: "X (Twitter)", icon: MessageCircle, hint: "Profile and brand accounts (API tier dependent)" },
  { key: "reddit", label: "Reddit", icon: MessagesSquare, hint: "Community posting with authenticated scopes" },
  { key: "pinterest", label: "Pinterest", icon: Pin, hint: "Pins and board management" },
  { key: "telegram", label: "Telegram", icon: MessageCircle, hint: "Bot-based group/channel setup" },
  { key: "discord", label: "Discord", icon: MessagesSquare, hint: "OAuth + bot/webhook channel setup" },
  { key: "googleBusiness", label: "Google Business Profile", icon: Building2, hint: "Business profile location updates" },
];

export const PLATFORM_CAPABILITY_MATRIX = {
  facebook: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  instagram: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  threads: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  linkedin: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  youtube: { badges: ["Posting", "Analytics", "Media Upload"], supportLevel: "full", oauth: true },
  x: { badges: ["Posting", "Limited API"], supportLevel: "limited", oauth: true },
  reddit: { badges: ["Posting", "Limited API"], supportLevel: "limited", oauth: true },
  pinterest: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  telegram: { badges: ["Posting", "Limited API"], supportLevel: "limited", oauth: false },
  discord: { badges: ["Posting", "Messaging", "Limited API"], supportLevel: "limited", oauth: true },
  googleBusiness: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
};
