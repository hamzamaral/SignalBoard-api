import * as https from 'https';

/**
 * Some TR gov sites present incomplete cert chains to Node.
 * Scrapers use this agent so TLS handshake can complete for public read-only fetches.
 */
export const scrapeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});
