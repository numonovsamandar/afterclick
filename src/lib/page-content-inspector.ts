/**
 * Inspects visible page text and links extracted by the content script.
 * Never reads passwords, form values, cookies, or authentication tokens.
 */
import { analyzeMessage, analyzeDomain, type Analysis, type Finding, type DomainAnalysis } from './inspector';

export interface PageLink {
  text: string;
  href: string;
  mismatch: boolean;
  domain: DomainAnalysis | null;
}

export interface PageContentAnalysis {
  textAnalysis: Analysis;
  links: PageLink[];
  linkMismatches: { text: string; displayedDomain: string; actualDomain: string }[];
  totalTextLength: number;
  truncated: boolean;
}

const MAX_TEXT = 15000;

export function analyzePageContent(
  text: string,
  links: { text: string; href: string }[]
): PageContentAnalysis {
  const truncated = text.length > MAX_TEXT;
  const trimmed = text.slice(0, MAX_TEXT);

  const textAnalysis = analyzeMessage(trimmed);

  const analyzedLinks: PageLink[] = [];
  const linkMismatches: PageContentAnalysis['linkMismatches'] = [];

  const seen = new Set<string>();
  for (const link of links.slice(0, 50)) {
    const identity = `${link.href}\n${link.text}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    const domain = link.href ? analyzeDomain(link.href) : null;

    // Check for text/href mismatch
    let mismatch = false;
    if (domain && link.text && link.text !== link.href) {
      // Does the displayed text look like a URL?
      const textLooksLikeUrl = /^(https?:\/\/)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}/i.test(link.text.trim());
      if (textLooksLikeUrl) {
        const textDomain = analyzeDomain(link.text.trim());
        if (textDomain.registrableDomain && domain.registrableDomain &&
            textDomain.registrableDomain !== domain.registrableDomain) {
          mismatch = true;
          linkMismatches.push({
            text: link.text,
            displayedDomain: textDomain.registrableDomain,
            actualDomain: domain.registrableDomain,
          });
        }
      }
    }

    analyzedLinks.push({ text: link.text, href: link.href, mismatch, domain });
  }

  return {
    textAnalysis,
    links: analyzedLinks,
    linkMismatches,
    totalTextLength: text.length,
    truncated,
  };
}
