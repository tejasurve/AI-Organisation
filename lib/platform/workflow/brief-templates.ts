// lib/platform/workflow/brief-templates.ts
//
// **Narrative classifier — NOT an artefact fabricator.**
//
// This file used to contain ~2,600 lines of synthesizers that fabricated
// HLDs, LLDs, features, stories, QA defects, code-review comments, security
// findings, and dev commits from regex pattern matching against the brief.
// That was the source of the "every project gets the same architecture +
// Stripe + PostGIS even when the brief explicitly excludes them" bug. The
// user explicitly flagged this as hardcoding.
//
// All of that is gone. Every architectural artefact is now produced by a
// real LLM call against the actual brief via `llm-generators.ts`. The
// engine throws (no silent demo fallback) if no LLM key is configured.
//
// What remains: a thin `classifyBrief()` helper used by `brief-chat.ts`
// to colour CHAT NARRATIVE (e.g. "got it — a service-finder for…") with
// a domain hint. It does NOT shape any structural artefact.

import type { ProjectBrief } from "./types.ts";

/**
 * Coarse brief category. Used ONLY by chat-narrative formatters in
 * `brief-chat.ts` to pick a flavour line. Never used to fabricate
 * architecture, features, stories, QA, or any structural artefact.
 */
export type BriefCategory =
  | "service-finder"
  | "marketplace"
  | "ecommerce"
  | "social"
  | "ai-tool"
  | "content"
  | "saas-tool";

export type Region = "uk" | "us" | "eu" | "global";

export interface DomainHints {
  region: Region;
  payments: boolean;
  geo: boolean;
  media: boolean;
  messaging: boolean;
}

export function classifyBrief(brief: ProjectBrief): {
  category: BriefCategory;
  hints: DomainHints;
} {
  const t = `${brief.name} ${brief.pitch} ${brief.audience ?? ""}`.toLowerCase();
  const hints: DomainHints = {
    region: extractRegion(t),
    payments: /\bpay(ment)?s?\b|stripe|subscription|billing|checkout|booking|deposit/.test(t),
    geo: /\bpostcode|postal code|zip|nearby|near me|radius|locate|map|location|distance\b/.test(t),
    media: /\bportfolio|photo|image|gallery|upload|video|media\b/.test(t),
    messaging: /\bcontact|message|chat|enquiry|enquir|dm |inbox\b/.test(t),
  };

  let category: BriefCategory = "saas-tool";
  if (
    /\b(find|finder|directory|listing|browse|search|locate|nearby|near me|near you|by postcode|postcode)\b/.test(t) &&
    /(artist|barber|plumber|electrician|trainer|coach|therapist|dentist|doctor|tutor|cleaner|handyman|service|professional|pro|business|shop|venue|studio|salon)/.test(t)
  ) {
    category = "service-finder";
  } else if (/\b(marketplace|two[- ]?sided|seller|buyer|listing|host|guest|peer[- ]?to[- ]?peer)\b/.test(t)) {
    category = "marketplace";
  } else if (/\b(ecommerce|e-commerce|store|shop|cart|catalog|sku|inventory|product page)\b/.test(t)) {
    category = "ecommerce";
  } else if (/\b(feed|follow|community|social|share|comment|like|posts?)\b/.test(t)) {
    category = "social";
  } else if (
    /\b(ai|llm|chatbot|generate|generation|summari[sz]e|prompt|gpt|gemini|claude)\b/.test(t) &&
    !/dashboard|tracking|productivity|workout|gym/.test(t)
  ) {
    category = "ai-tool";
  } else if (/\b(content|cms|blog|publish|article|newsletter|writer)\b/.test(t)) {
    category = "content";
  }

  return { category, hints };
}

function extractRegion(blob: string): Region {
  if (/\b(uk|british|england|scotland|wales|gb)\b/i.test(blob)) return "uk";
  if (/\b(usa?|united states|america)\b/i.test(blob)) return "us";
  if (/\b(eu|europe(?:an)?)\b/i.test(blob)) return "eu";
  return "global";
}
