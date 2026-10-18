/** Constants shared across the extension. */

export const WEBSITE_URL = 'https://afterclick-nine.vercel.app';

// Incident type → route mapping for the website
export const INCIDENT_ROUTES: Record<string, { incident: string; label: string }> = {
  password: { incident: 'password', label: 'I entered my password on a fake site' },
  code: { incident: 'code', label: 'I shared a verification code' },
  payment: { incident: 'payment', label: 'I sent money to a scammer' },
  link: { incident: 'link', label: 'I clicked a suspicious link' },
  remote: { incident: 'remote', label: 'I let someone control my computer' },
  download: { incident: 'link', label: 'I downloaded or opened something suspicious' },
};

export function getIncidentUrl(incidentType: string, source = 'extension'): string {
  const route = INCIDENT_ROUTES[incidentType];
  if (!route) return WEBSITE_URL;
  return `${WEBSITE_URL}/?incident=${encodeURIComponent(route.incident)}&source=${encodeURIComponent(source)}`;
}

export const CHROME_RESTRICTED_PATTERNS = [
  /^chrome:/,
  /^chrome-extension:/,
  /^about:/,
  /^edge:/,
  /^brave:/,
  /^devtools:/,
  /^view-source:/,
  /^data:/,
  /^file:/,
  /^chrome-untrusted:/,
];

export function isRestrictedUrl(url: string): boolean {
  return CHROME_RESTRICTED_PATTERNS.some((p) => p.test(url));
}
