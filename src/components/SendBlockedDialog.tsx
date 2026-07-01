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
  | "profile-and-plan";

const COPY: Record<SendBlockReason, { title: string; body: string }> = {
  profile: {
    title: "Hold your horses, carrot cadet 🥕",
    body: "Your profile is still greener than a garden. Fill it in so we know where to send the good news (and the receipts).",
  },
  plan: {
    title: "Whoa, cowboy. This carrot isn't ripe yet.",
    body: "Sending is a paid superpower. Grab a plan and we'll unleash your outreach on the world.",
  },
  "profile-and-plan": {
    title: "Almost there, launcher!",
    body: "Finish your profile and pick a plan. Two tiny steps between you and 5,000 gloriously personalized emails.",
  },
  mailbox: {
    title: "No mailbox, no missiles.",
    body: "Connect your Gmail (or Outlook, soon) so we can send from your inbox, not ours.",
  },
  quota: {
    title: "You emptied the tank 🚀",
    body: "You've used every send in this billing period. It refills next cycle, or upgrade to Lifetime for unlimited.",
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
