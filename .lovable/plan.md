# Quill payments and access tiers

## Recommendation
Use **Dodo Payments**. Lovable’s built-in Stripe option is unavailable for sellers based in India, and Quill is not eligible for the built-in Paddle integration. Dodo is a strong fit for an India-based SaaS founder selling to US customers because it supports subscriptions, one-time payments, USD checkout, and merchant-of-record tax and compliance handling.

## Offer structure
- **Pro, $19/month:** product access plus usage billed or limited separately.
- **Lifetime Launch, $9.99 once:** permanent access to product features, but usage is still metered or purchased separately.
- Limit the launch offer to the **first 100 completed purchases** by default. Enforce this on the server so it cannot oversell through UI manipulation.
- Existing users without an entitlement see pricing and upgrade prompts rather than unrestricted paid features.

## Implementation
1. Add a focused pricing and checkout experience matching Quill’s current visual system, with clear wording that lifetime covers feature access, not unlimited sending costs.
2. Add secure billing records for customers, purchases, subscriptions, entitlements, and the lifetime-offer counter. Users can only view their own billing state.
3. Integrate Dodo checkout through authenticated server functions. Keep the API key server-only and validate all checkout inputs.
4. Add a public webhook endpoint with signature verification and idempotent event processing. Grant or revoke access only from verified payment events, never from browser redirects.
5. Gate paid Quill features using server-verified entitlements. Treat active Pro subscriptions and successful lifetime purchases as paid access.
6. Add billing status and management controls inside the authenticated app, including current tier, renewal status, lifetime ownership, and a customer portal link when supported.
7. Test successful checkout, cancellation, failed payment, duplicate webhook, sold-out lifetime offer, and unauthorized access paths.

## Setup required during implementation
- Create the Pro subscription and Lifetime Launch products in Dodo.
- Securely add the Dodo API key and webhook signing secret after the webhook URL exists.
- Use USD pricing for the US target market. Dodo handles applicable checkout tax and compliance as merchant of record.