// Server-only Gmail helpers for the Automation module: draft creation,
// draft verification (CC header read-back), thread/message reads, history sync.
// All calls run server-side with the mailbox's stored access token; tokens are
// never returned to the browser.

import { getActiveAccessToken, type GmailMailbox } from "@/lib/gmail-send.server";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, context: string) {
    const friendly =
      status === 401 || status === 403
        ? "Gmail access expired or insufficient permissions (reconnect the mailbox)"
        : status === 429
          ? "Gmail API rate limit exceeded, try again shortly"
          : status >= 500
            ? "Gmail is temporarily unavailable, try again shortly"
            : `Gmail request failed (${status})`;
    super(`${context}: ${friendly}`);
    this.status = status;
    this.body = body;
  }
}

async function gmailFetch(mailbox: GmailMailbox, path: string, init?: RequestInit) {
  const token = await getActiveAccessToken(mailbox);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new GmailApiError(res.status, await res.text(), path);
  return res.json();
}

export type GmailAttachmentInput = {
  filename: string;
  contentType: string;
  dataBase64: string;
};

// Create a Gmail draft. `raw` is the base64url RFC2822 message; threadId keeps
// the draft inside an existing conversation (used for follow-ups).
export async function createDraft(
  mailbox: GmailMailbox,
  raw: string,
  opts: { threadId?: string } = {},
): Promise<{ id: string; message: { id: string; threadId: string } }> {
  return gmailFetch(mailbox, "/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw, ...(opts.threadId ? { threadId: opts.threadId } : {}) } }),
  });
}

// Read a draft back and extract selected headers. Used to verify the saved
// Cc header matches what we asked for before reporting success.
export async function getDraftHeaders(
  mailbox: GmailMailbox,
  draftId: string,
  headers: string[],
): Promise<Record<string, string>> {
  const d = await gmailFetch(mailbox, `/drafts/${draftId}?format=metadata`) as {
    message?: { payload?: { headers?: { name: string; value: string }[] } };
  };
  const out: Record<string, string> = {};
  for (const h of d.message?.payload?.headers ?? []) {
    const lower = h.name.toLowerCase();
    if (headers.some((x) => x.toLowerCase() === lower)) out[lower] = h.value;
  }
  return out;
}

export async function deleteDraft(mailbox: GmailMailbox, draftId: string): Promise<void> {
  const token = await getActiveAccessToken(mailbox);
  const res = await fetch(`${API}/drafts/${draftId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // Deleting an already-gone draft is fine.
  if (!res.ok && res.status !== 404) throw new GmailApiError(res.status, await res.text(), "delete draft");
}

export async function getMessage(
  mailbox: GmailMailbox,
  messageId: string,
  format: "metadata" | "full" = "metadata",
) {
  return gmailFetch(mailbox, `/messages/${messageId}?format=${format}`);
}

export async function getThread(mailbox: GmailMailbox, threadId: string) {
  return gmailFetch(mailbox, `/threads/${threadId}?format=metadata`);
}

export async function listMessages(
  mailbox: GmailMailbox,
  query: { q?: string; labelIds?: string[]; maxResults?: number; pageToken?: string; includeSpamTrash?: boolean },
) {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.labelIds) for (const l of query.labelIds) p.append("labelIds", l);
  if (query.maxResults) p.set("maxResults", String(query.maxResults));
  if (query.pageToken) p.set("pageToken", query.pageToken);
  if (query.includeSpamTrash) p.set("includeSpamTrash", "true");
  return gmailFetch(mailbox, `/messages?${p.toString()}`) as Promise<{
    messages?: { id: string; threadId: string }[];
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }>;
}

// Send a raw message (Mode B follow-up sending). Returns Gmail's response
// (message id + threadId); a 2xx does NOT mean the mail was delivered.
export async function sendMessageRaw(mailbox: GmailMailbox, raw: string, threadId?: string) {
  return gmailFetch(mailbox, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
  });
}

export async function getHistoryId(mailbox: GmailMailbox) {
  const p = await gmailFetch(mailbox, "/profile") as { historyId?: string };
  return p.historyId ?? null;
}

export async function listHistory(
  mailbox: GmailMailbox,
  startHistoryId: string,
  pageToken?: string,
) {
  const p = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded" });
  if (pageToken) p.set("pageToken", pageToken);
  return gmailFetch(mailbox, `/history?${p.toString()}`) as Promise<{
    history?: { messages?: { id: string }[] }[];
    historyId?: string;
    nextPageToken?: string;
  }>;
}
