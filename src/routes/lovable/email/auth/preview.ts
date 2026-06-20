import * as React from "react";
import { render } from "@react-email/render";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

type EmailTemplateComponent = React.ComponentType<Record<string, unknown>>;

const EMAIL_TEMPLATES: Record<string, EmailTemplateComponent> = {
  signup: SignupEmail as unknown as EmailTemplateComponent,
  invite: InviteEmail as unknown as EmailTemplateComponent,
  magiclink: MagicLinkEmail as unknown as EmailTemplateComponent,
  recovery: RecoveryEmail as unknown as EmailTemplateComponent,
  email_change: EmailChangeEmail as unknown as EmailTemplateComponent,
  reauthentication: ReauthenticationEmail as unknown as EmailTemplateComponent,
};

const SITE_NAME = "carrotmails";
const SAMPLE_PROJECT_URL = "https://carrotmails.lovable.app";
const SAMPLE_EMAIL = "user@example.test";
const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: "123456",
  },
};

export const Route = createFileRoute("/lovable/email/auth/preview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;

        if (!apiKey) {
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const authHeader = request.headers.get("Authorization");
        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let type: string;
        try {
          const body = await request.json();
          type = body.type;
        } catch {
          return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }

        const EmailTemplate = EMAIL_TEMPLATES[type];

        if (!EmailTemplate) {
          return Response.json({ error: `Unknown email type: ${type}` }, { status: 400 });
        }

        const sampleData = SAMPLE_DATA[type] || {};
        const html = await render(React.createElement(EmailTemplate, sampleData));

        return new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
