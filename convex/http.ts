import { httpRouter } from "convex/server";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import Stripe from "stripe";

type KindeEventData = {
  user: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string | null;
    is_password_reset_requested: boolean;
    is_suspended: boolean;
    organizations: {
      code: string;
      permissions: string | null;
      roles: string | null;
    }[];
    phone?: string | null;
    username?: string | null;
    image_url?: string | null;
  };
};

type KindeEvent = {
  type: string;
  data: KindeEventData;
};

const http = httpRouter();

const handleKindeWebhook = httpAction(async (ctx, request) => {
  const event = await validateKindeRequest(request);
  if (!event) {
    return new Response("Invalid request", { status: 400 });
  }

  switch (event.type) {
    case "user.created":
      await ctx.runMutation(internal.users.createUserKinde, {
        kindeId: event.data.user.id,
        email: event.data.user.email,
        firstName: event.data.user.first_name || "",
        lastName: event.data.user.last_name || ""
      });
      break;
    {/** 
    case "user.updated":
      const existingUserOnUpdate = await ctx.runQuery(
        internal.users.getUserKinde,
        { kindeId: event.data.user.id }
      );

      if (existingUserOnUpdate) {
        await ctx.runMutation(internal.users.updateUserKinde, {
          kindeId: event.data.user.id,
          email: event.data.user.email,
          username: event.data.user.first_name || ""
        });
      } else {
        console.warn(
          `No user found to update with kindeId ${event.data.user.id}.`
        );
      }
      break;
    */}
    case "user.deleted":
      const userToDelete = await ctx.runQuery(internal.users.getUserKinde, {
        kindeId: event.data.user.id,
      });

      if (userToDelete) {
        await ctx.runMutation(internal.users.deleteUserKinde, {
          kindeId: event.data.user.id,
        });
      } else {
        console.warn(
          `No user found to delete with kindeId ${event.data.user.id}.`
        );
      }
      break;
    default:
      console.warn(`Unhandled event type: ${event.type}`);
  }

  return new Response(null, { status: 200 });
});

// ===== JWT Validation =====
async function validateKindeRequest(request: Request): Promise<KindeEvent | null> {
  try {
    if (request.headers.get("content-type") !== "application/jwt") {
      console.error("Invalid Content-Type. Expected application/jwt");
      return null;
    }

    const token = await request.text(); // JWT is sent as raw text in the body.
    const JWKS_URL = `${process.env.KINDE_ISSUER_URL}/.well-known/jwks.json`;
    const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

    const { payload } = await jwtVerify(token, JWKS);

    // Ensure payload contains the expected properties
    if (
      typeof payload === "object" &&
      payload !== null &&
      "type" in payload &&
      "data" in payload
    ) {
      return {
        type: payload.type as string,
        data: payload.data as KindeEventData,
      };
    } else {
      console.error("Payload does not match the expected structure");
      return null;
    }
  } catch (error) {
    console.error("JWT verification failed", error);
    return null;
  }
}

http.route({
  path: "/kinde",
  method: "POST",
  handler: handleKindeWebhook,
});

// ===== Stripe webhook =====
//
// Payment confirmation lands here rather than in a Next.js route so it can call
// the internal mutation that writes `plan` directly — that mutation is not
// reachable from any client, which is what stops an account granting itself a
// paid plan.
//
// Point Stripe at: <CONVEX_SITE_URL>/stripe

const handleStripeWebhook = httpAction(async (ctx, request) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("[stripe] webhook received but Stripe is not configured");
    return new Response("Billing not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // The raw body is required — parsing it first would break the signature.
  const payload = await request.text();

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-07-29.dahlia",
    // Convex runs on web APIs, not Node's http stack.
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error("[stripe] signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      // Anything unpaid (an async payment method still pending) is ignored —
      // `checkout.session.async_payment_succeeded` covers it when it clears.
      if (session.payment_status !== "paid") {
        console.log("[stripe] checkout completed but unpaid:", session.id);
        break;
      }

      await applyCheckout(ctx, session);
      break;
    }

    case "checkout.session.async_payment_succeeded": {
      await applyCheckout(ctx, event.data.object);
      break;
    }

    default:
      // Everything else is noise while payments are handled by hand.
      break;
  }

  return new Response(null, { status: 200 });
});

async function applyCheckout(
  ctx: { runMutation: (fn: any, args: any) => Promise<any> },
  session: Stripe.Checkout.Session,
) {
  const plan = session.metadata?.plan;
  if (!plan) {
    console.error("[stripe] checkout session has no plan metadata:", session.id);
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  const result = await ctx.runMutation(internal.billing.recordPurchase, {
    kindeId: session.metadata?.kindeId ?? session.client_reference_id ?? undefined,
    email: session.customer_details?.email ?? session.customer_email ?? undefined,
    stripeCustomerId: customerId ?? undefined,
    checkoutSessionId: session.id,
    plan,
  });

  console.log("[stripe] purchase applied", session.id, result);
}

http.route({
  path: "/stripe",
  method: "POST",
  handler: handleStripeWebhook,
});

// ===== Custom domain resolution =====
//
// A request arriving on reports.acme.com has to become a request for that
// client's dashboard before anything renders. The proxy runs at the edge with no
// database of its own, so it asks here.
//
// Deliberately tiny and deliberately public: it maps a hostname somebody has
// already pointed at this product to the slug it stands for, which is a fact
// that host announces by existing. It answers nothing about a host it does not
// recognise, and reveals nothing about the client beyond the slug the URL would
// have carried anyway.
//
// Cached hard. This is on the critical path of every request to a custom domain,
// and the mapping changes about once per customer per year.

const handleResolveDomain = httpAction(async (ctx, request) => {
  const host = new URL(request.url).searchParams.get("host")?.toLowerCase().trim();

  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    // A minute at the edge, a day while revalidating. A domain that has just
    // been pointed here starts working within the minute; one that has worked
    // for a year costs nothing.
    "cache-control": "public, max-age=60, stale-while-revalidate=86400",
  };

  if (!host) return new Response(JSON.stringify({ slug: null }), { status: 200, headers });

  const slug = await ctx.runQuery(api.clients.slugForDomain, { host });
  return new Response(JSON.stringify({ slug }), { status: 200, headers });
});

http.route({
  path: "/resolve-domain",
  method: "GET",
  handler: handleResolveDomain,
});

// ===== View tracking =====
//
// Called by proxy.ts on every view of a client dashboard or a portfolio.
//
// It lives here rather than in a Next.js route so the proxy reaches Convex in
// one hop. The proxy runs ahead of the page on every request; routing it
// through a Next function first would put a second cold-startable invocation
// in front of traffic that must not be slowed down to be counted.
//
// The proxy does not await this, so a failure here costs a missing row and
// nothing else. That tradeoff is deliberate: a page must never be slower, or
// fail, because analytics did.

const handleTrack = httpAction(async (ctx, request) => {
  // Echoed on every response below — the portfolio beacon calls this from the
  // browser, cross-origin from the app domain.
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };

  try {
    const body = await request.json();

    if (body.kind === "duration") {
      await ctx.runMutation(api.analytics.recordDuration, {
        target: String(body.target ?? ""),
        visitorHash: String(body.visitorHash ?? ""),
        durationMs: Number(body.durationMs ?? 0),
      });
      return new Response(null, { status: 204, headers: cors });
    }

    if (
      body.surface !== "dashboard" &&
      body.surface !== "portfolio" &&
      body.surface !== "site"
    ) {
      return new Response("bad surface", { status: 400, headers: cors });
    }

    await ctx.runMutation(api.analytics.record, {
      surface: body.surface,
      target: String(body.target ?? ""),
      path: String(body.path ?? "/"),
      visitorHash: String(body.visitorHash ?? ""),
      sessionTokenHash: body.sessionTokenHash || undefined,
      country: body.country || undefined,
      referrer: body.referrer || undefined,
    });

    return new Response(null, { status: 204, headers: cors });
  } catch (error) {
    // Swallowed rather than surfaced. The rate limiter throws a ConvexError on
    // a flood, and that is a normal outcome here, not an incident.
    console.error("[track] dropped", error);
    return new Response(null, { status: 204, headers: cors });
  }
});

http.route({ path: "/track", method: "POST", handler: handleTrack });

http.route({
  path: "/track",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;