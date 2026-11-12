import { getIndexNowKey } from "@/lib/indexnow";

// The IndexNow key file. Search engines fetch https://<site>/<key>.txt to
// check that whoever submits URLs for this host owns it; next.config.ts
// rewrites /<anything>.txt at the site root onto this route with the file's
// base name as `key`. It answers only when that name IS the configured key,
// so the route can't be used to discover the key - every other name, and a
// site with no key configured, gets a plain 404.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const configured = getIndexNowKey();

  if (!configured || key !== configured) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }

  return new Response(configured, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}
