import { parse as legacyParse } from 'node:url';

// The server sends requests to subscription endpoints, so only real browser push services are allowed.
const PUSH_SERVICE_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

/**
 * True for an https push-service URL written in canonical form. The canonical
 * check matters: web-push sends with Node's legacy `url.parse`, which reads
 * some non-canonical URLs (encoded dots, missing slashes) as a different host
 * than the WHATWG parser, so both parsers must agree on the allowed host.
 */
export function isPushServiceEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.href === value &&
    url.protocol === 'https:' &&
    !url.port &&
    !url.username &&
    !url.password &&
    PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname)) &&
    legacyParse(value).hostname === url.hostname
  );
}
