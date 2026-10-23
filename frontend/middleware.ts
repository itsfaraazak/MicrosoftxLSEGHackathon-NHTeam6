import { NextRequest } from "next/server";

// Proxies /api/* to the backend's ngrok tunnel, server-side, so phones only
// ever see this Vercel origin. We can't use a plain vercel.json rewrite here
// because ngrok's free-tier browser-warning interstitial intercepts any
// request that looks like it came from a browser UNLESS the request carries
// the header `ngrok-skip-browser-warning`. A vercel.json rewrite has no way
// to inject that header onto the proxied request, so we do the proxy fetch
// here instead, where we fully control outgoing headers.
export const config = {
  matcher: "/api/:path*",
};

const TARGET_ORIGIN = "https://superbowl-jalapeno-mower.ngrok-free.dev";

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const target = TARGET_ORIGIN + url.pathname + url.search;

  const headers = new Headers(request.headers);
  headers.set("ngrok-skip-browser-warning", "true");
  headers.delete("host");

  const hasBody = !["GET", "HEAD"].includes(request.method);

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (hasBody) {
    init.body = request.body;
    init.duplex = "half";
  }

  return fetch(target, init).then((upstream) => {
    const respHeaders = new Headers(upstream.headers);
    respHeaders.delete("content-encoding");
    respHeaders.delete("content-length");
    respHeaders.delete("transfer-encoding");
    respHeaders.delete("connection");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  });
}
