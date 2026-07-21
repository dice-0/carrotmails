import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type SendBlockReason =
  | "profile"
  | "plan"
  | "mailbox"
  | "quota"
  | "consent"
  | "profile-and-plan";

const COPY: Record<SendBlockReason, { title: string; body: string }> = {
  profile: {
    title: "One quick step first",
    body: "Add your name and business email in Profile so recipients know exactly who is contacting them. It also anchors your account and receipts.",
  },
  plan: {
    title: "Carrot Mails is a paid tool",
    body: "Sending is available on Premium or Lifetime. Pick a plan to unlock consent-based campaigns to your opted-in contacts.",
  },
  "profile-and-plan": {
    title: "Two small steps to launch",
    body: "Finish your profile and choose a plan. Both are one-time setups, and then your opted-in campaigns are ready to send.",
  },
  mailbox: {
    title: "Connect your mailbox",
    body: "Carrot Mails sends from your own inbox, not ours. Connect Gmail so your recipients see your address in their inbox.",
  },
  quota: {
    title: "You've reached this period's cap",
    body: "You've used every send in this billing period. It refills next cycle, or upgrade to Lifetime for unlimited.",
  },
  consent: {
    title: "Confirm recipient consent",
    body: "Carrot Mails only supports permission-based sending. Confirm that every recipient explicitly opted in to hear from you before we can dispatch this message.",
  },
};

export function SendBlockedDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reason: SendBlockReason;
}) {
  const copy = COPY[reason];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="text-xl">{copy.title}</DialogTitle>
          <DialogDescription className="pt-2 text-base leading-relaxed">
            {copy.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {(reason === "profile" || reason === "profile-and-plan") && (
            <Button asChild variant="outline">
              <Link to="/app/profile" onClick={() => onOpenChange(false)}>Complete profile</Link>
            </Button>
          )}
          {(reason === "plan" || reason === "profile-and-plan" || reason === "quota") && (
            <Button asChild>
              <Link to="/app/billing" onClick={() => onOpenChange(false)}>Choose a plan</Link>
            </Button>
          )}
          {reason === "mailbox" && (
            <Button asChild>
              <Link to="/app/mailboxes" onClick={() => onOpenChange(false)}>Connect mailbox</Link>
            </Button>
          )}
          {reason === "consent" && (
            <Button onClick={() => onOpenChange(false)}>Got it</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
