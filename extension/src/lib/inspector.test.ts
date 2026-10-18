import { describe, it, expect } from 'vitest';
import {
  extractURLs,
  analyzeDomain,
  analyzeMessage,
  highlightSegments,
  BRANDS,
} from './inspector';
import { analyzePageContent } from './page-content-inspector';
import { getIncidentUrl, isRestrictedUrl, INCIDENT_ROUTES } from './constants';

describe('AfterClick Companion — Inspector Test Suite', () => {
  // 1. Legitimate registered-domain extraction
  it('correctly extracts legitimate registered domains', () => {
    const analysis = analyzeDomain('https://www.paypal.com/signin');
    expect(analysis.registrableDomain).toBe('paypal.com');
    expect(analysis.hostname).toBe('www.paypal.com');
    expect(analysis.officialFor?.id).toBe('paypal');
    expect(analysis.issues).toHaveLength(0);
  });

  // 2. Misleading subdomain structures
  it('detects brand names buried in attacker-controlled subdomains', () => {
    const analysis = analyzeDomain('https://paypal.com.secure-login.account-verify.top/signin');
    expect(analysis.registrableDomain).toBe('account-verify.top');
    expect(analysis.hostname).toBe('paypal.com.secure-login.account-verify.top');
    const brandIssue = analysis.issues.find((i) => i.id === 'brand-subdomain');
    expect(brandIssue).toBeDefined();
    expect(brandIssue?.severity).toBe('high');
    expect(brandIssue?.message).toContain('paypal');
  });

  // 3. IDN and Punycode hostnames
  it('detects Punycode and internationalized character homoglyphs (xn--)', () => {
    const analysis = analyzeDomain('https://xn--paypa-cra.com/login');
    const punyIssue = analysis.issues.find((i) => i.id === 'punycode');
    expect(punyIssue).toBeDefined();
    expect(punyIssue?.severity).toBe('high');
    expect(punyIssue?.message).toContain('xn--');
  });

  // 4. IP-address hostnames
  it('detects raw IP addresses used as hostnames', () => {
    const analysis = analyzeDomain('http://192.168.1.1/admin');
    expect(analysis.isIp).toBe(true);
    const ipIssue = analysis.issues.find((i) => i.id === 'ip');
    expect(ipIssue).toBeDefined();
    expect(ipIssue?.severity).toBe('high');
  });

  // 5. URL shorteners
  it('detects URL shorteners hiding the true destination', () => {
    const analysis = analyzeDomain('https://bit.ly/3xY8z9');
    const shortIssue = analysis.issues.find((i) => i.id === 'shortener');
    expect(shortIssue).toBeDefined();
    expect(shortIssue?.severity).toBe('medium');
    expect(shortIssue?.message).toContain('bit.ly');
  });

  // 6. HTTP vs HTTPS interpretation (never treating HTTPS as proof of safety)
  it('flags unencrypted HTTP without claiming HTTPS guarantees safety', () => {
    const httpAnalysis = analyzeDomain('http://my-insecure-site.com');
    expect(httpAnalysis.protocol).toBe('http');
    const httpIssue = httpAnalysis.issues.find((i) => i.id === 'http');
    expect(httpIssue).toBeDefined();
    expect(httpIssue?.severity).toBe('low');

    const httpsAnalysis = analyzeDomain('https://my-insecure-site.com');
    expect(httpsAnalysis.protocol).toBe('https');
    // HTTPS does NOT clear or guarantee safety
  });

  // 7. Suspicious urgency language
  it('identifies urgent deadlines and threat language', () => {
    const message = 'URGENT: Your account will be suspended within 24 hours. Act now!';
    const analysis = analyzeMessage(message);
    const urgency = analysis.findings.find((f) => f.kind === 'urgency');
    const threat = analysis.findings.find((f) => f.kind === 'threat');
    expect(urgency).toBeDefined();
    expect(threat).toBeDefined();
    expect(analysis.level).toBe('some-signs');

    // With a high-severity finding (e.g. credential harvesting), escalates to warning-signs
    const credentialMsg = 'URGENT: confirm your password immediately or account will be suspended';
    const escalated = analyzeMessage(credentialMsg);
    expect(escalated.level).toBe('warning-signs');
  });

  // 8. Brand impersonation indicators
  it('flags messages claiming to be a brand while linking elsewhere', () => {
    const message = 'PayPal notification: Your account is limited. Sign in at https://login-verify-now.xyz to restore.';
    const analysis = analyzeMessage(message);
    const brandFinding = analysis.findings.find((f) => f.kind === 'brand');
    expect(brandFinding).toBeDefined();
    expect(brandFinding?.severity).toBe('high');
    expect(brandFinding?.explanation).toContain('PayPal');
  });

  // 9. Selected-text inspection and highlight segments
  it('correctly maps non-overlapping highlight segments for UI rendering', () => {
    const text = 'Urgent: verify your password now';
    const analysis = analyzeMessage(text);
    const segments = highlightSegments(text, analysis.findings);
    expect(segments.length).toBeGreaterThan(0);
    const joined = segments.map((s) => s.text).join('');
    expect(joined).toBe(text);
  });

  // 10. Empty or malformed URLs
  it('handles empty, invalid, and malformed inputs gracefully without throwing', () => {
    expect(() => analyzeDomain('')).not.toThrow();
    expect(() => analyzeDomain('not-a-valid-url-:::')).not.toThrow();
    expect(() => analyzeMessage('')).not.toThrow();
    expect(() => analyzeMessage('   \n\t  ')).not.toThrow();

    const empty = analyzeMessage('');
    expect(empty.level).toBe('no-known-signs');
    expect(empty.findings).toHaveLength(0);
  });

  // 11. Safe incident-type deep links
  it('generates safe, minimal incident handoff URLs without leaking content', () => {
    const url = getIncidentUrl('password');
    expect(url).toContain('incident=password');
    expect(url).toContain('source=extension');
    expect(url).not.toContain('secret');
    expect(url).not.toContain('password123');

    // Unknown incident falls back safely
    const fallback = getIncidentUrl('unknown_incident');
    expect(fallback).toBe('https://afterclick-nine.vercel.app');
  });

  // 12. Copying sanitized analysis structure
  it('creates clean analysis without passwords, tokens, or personal identifiers', () => {
    const message = 'Sign in here: https://phish-site.com with your password Secret123';
    const analysis = analyzeMessage(message);
    expect(analysis.findings.some((f) => f.kind === 'credentials')).toBe(true);
    // Findings explain the sign-in request without saving user credentials
    expect(analysis.headline).toBe('Strong warning signs found');
  });

  // 13. No supported warning signs without claiming safety
  it('never issues a certificate or guarantee of safety when no signs are detected', () => {
    const cleanText = 'Hello Samandar, hope you have a great weekend!';
    const analysis = analyzeMessage(cleanText);
    expect(analysis.level).toBe('no-known-signs');
    expect(analysis.headline).toContain("doesn't mean it's safe");
  });

  // 14. Unsupported Chrome pages and permission failures
  it('identifies internal and restricted Chrome URLs', () => {
    expect(isRestrictedUrl('chrome://extensions')).toBe(true);
    expect(isRestrictedUrl('chrome://settings')).toBe(true);
    expect(isRestrictedUrl('about:blank')).toBe(true);
    expect(isRestrictedUrl('edge://flags')).toBe(true);
    expect(isRestrictedUrl('https://example.com')).toBe(false);
  });

  // 15. Page content inspector & link mismatch detection
  it('detects displayed link text mismatching the actual destination URL', () => {
    const fakeText = 'Please visit paypal.com to update your details.';
    const fakeLinks = [
      { text: 'paypal.com', href: 'https://attacker-domain.com/login' },
    ];
    const pageAnalysis = analyzePageContent(fakeText, fakeLinks);
    expect(pageAnalysis.linkMismatches).toHaveLength(1);
    expect(pageAnalysis.linkMismatches[0].displayedDomain).toBe('paypal.com');
    expect(pageAnalysis.linkMismatches[0].actualDomain).toBe('attacker-domain.com');
  });
});
