import "server-only";

// IndexNow (https://www.indexnow.org/documentation): tells Bing - and through
// it every other participating engine - that URLs were added or changed.
//
// - One endpoint is enough; api.indexnow.org shares submissions with all
//   participating search engines.
// - Ownership is proved by a key file at the site root, /{key}.txt, containing
//   the key. Here the key lives in the INDEXNOW_KEY env var and the file is
//   served by app/api/indexnow-key/[key]/route.ts (via a rewrite in
//   next.config.ts) rather than committed under public/: the repo is public,
//   and the protocol says only the site owner and the search engines should
//   know the key.
// - 200 = accepted; 202 = accepted, key validation still pending. Both are
//   success. 403 = key file not found / wrong, 422 = a URL isn't on this host,
//   429 = too many requests.

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** Protocol limit per POST. */
export const INDEXNOW_MAX_URLS = 10_000;
/** 8-128 characters from a-z, A-Z, 0-9 and "-". */
const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

/** The configured key, or null when INDEXNOW_KEY is missing or malformed. */
export function getIndexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && KEY_RE.test(key) ? key : null;
}

export interface IndexNowResult {
  /** True for 200 and 202. */
  ok: boolean;
  /** HTTP status from IndexNow; 0 when the request never got a response. */
  status: number;
  /** Response body (usually empty on success), trimmed for logs. */
  detail: string;
  submitted: number;
}

/**
 * Submits `urls` (absolute, percent-encoded, all on `siteUrl`'s host) in one
 * POST. Never throws - callers report the result.
 */
export async function submitToIndexNow(siteUrl: string, urls: string[]): Promise<IndexNowResult> {
  const key = getIndexNowKey();
  if (!key) {
    return { ok: false, status: 0, detail: "INDEXNOW_KEY is not set or not valid", submitted: 0 };
  }
  if (urls.length === 0) return { ok: true, status: 200, detail: "nothing to submit", submitted: 0 };
  if (urls.length > INDEXNOW_MAX_URLS) {
    return { ok: false, status: 0, detail: `more than ${INDEXNOW_MAX_URLS} URLs`, submitted: 0 };
  }

  const site = new URL(siteUrl);
  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: site.host,
        key,
        keyLocation: `${site.origin}/${key}.txt`,
        urlList: urls,
      }),
    });
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    return {
      ok: response.status === 200 || response.status === 202,
      status: response.status,
      detail,
      submitted: urls.length,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : String(err),
      submitted: 0,
    };
  }
}

/**
 * The daily batch: the pages that change every day, plus anything in the
 * sitemap that has never been submitted before. Pure, so it can be tested
 * without a database or a network.
 */
export function selectUrlsToSubmit(opts: {
  /** Every URL currently in the sitemap. */
  sitemapUrls: string[];
  /** Pages to submit on every run. */
  dailyUrls: string[];
  /** URLs already submitted at some point (the indexnow_urls table). */
  knownUrls: ReadonlySet<string>;
}): { urls: string[]; newUrls: string[] } {
  const newUrls = [...new Set(opts.sitemapUrls)].filter((url) => !opts.knownUrls.has(url));
  return { urls: [...new Set([...opts.dailyUrls, ...newUrls])], newUrls };
}
