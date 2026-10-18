/**
 * AfterClick Companion — Content script.
 * Injected on demand only when the user explicitly requests page inspection.
 * Extracts limited visible text and link information.
 * 
 * NEVER extracts:
 * - Password fields or form input values
 * - Authentication tokens or cookies
 * - Local storage or hidden application state
 * - Sensitive payment information
 */

const MAX_TEXT_LENGTH = 15000;
const MAX_LINKS = 50;

function extractVisibleText(): string {
  // Get visible text content, not form values
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        
        // Skip hidden elements
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip script, style, and form input elements
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'template', 'input', 'textarea', 'select'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const parts: string[] = [];
  let totalLen = 0;
  let node: Node | null;
  while ((node = walker.nextNode()) && totalLen < MAX_TEXT_LENGTH) {
    const text = (node.textContent ?? '').trim();
    if (text) {
      parts.push(text);
      totalLen += text.length;
    }
  }

  return parts.join(' ').slice(0, MAX_TEXT_LENGTH);
}

function extractLinks(): { text: string; href: string }[] {
  const links: { text: string; href: string }[] = [];
  const anchors = document.querySelectorAll('a[href]');
  const seen = new Set<string>();
  
  for (const anchor of anchors) {
    if (links.length >= MAX_LINKS) break;
    const a = anchor as HTMLAnchorElement;
    const href = a.href;
    
    // Skip empty, javascript:, and mailto: links
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href === '#') continue;
    if (seen.has(href)) continue;
    seen.add(href);
    
    const text = (a.textContent ?? '').trim().slice(0, 200);
    links.push({ text, href });
  }
  
  return links;
}

// Listen for extraction requests from the background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    try {
      const text = extractVisibleText();
      const links = extractLinks();
      sendResponse({
        text,
        links,
        url: window.location.href,
        title: document.title,
      });
    } catch (err) {
      sendResponse({
        text: '',
        links: [],
        url: window.location.href,
        title: document.title,
        error: (err as Error).message,
      });
    }
    return true;
  }
  return false;
});

export {};
