// Gate the live grading page AND its subresources (/live, /live/, /live.js, /live.css).
// Landing (/), demo and all other pages stay public.
const PROTECTED_PREFIX = "/live";

export async function onRequest(context) {
  const { request, env } = context;

  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return await context.next(); // public pages pass through
  }

  const authUser = env.AUTH_USER;
  const authPass = env.AUTH_PASS;

  // Fail-closed if credentials are not configured
  if (!authUser || !authPass) {
    return unauthorizedResponse();
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  try {
    const base64Credentials = authHeader.slice(6).trim();
    const credentials = atob(base64Credentials);
    const colonIndex = credentials.indexOf(":");

    if (colonIndex !== -1) {
      const user = credentials.substring(0, colonIndex);
      const pass = credentials.substring(colonIndex + 1);

      if (timingSafeEqual(user, authUser) && timingSafeEqual(pass, authPass)) {
        return await context.next();
      }
    }
  } catch (error) {
    // Decoding or parsing failed
  }

  return unauthorizedResponse();
}

function unauthorizedResponse() {
  return new Response("Login required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="GradingAI Demo"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
