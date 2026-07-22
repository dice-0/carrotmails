import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/AppPage";
import { Button } from "@/components/ui/button";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";


export const Route = createFileRoute("/_authenticated/app/profile")({
  head: () => ({
    meta: [
      { title: "Profile | Carrot Mails" },
      { name: "description", content: "Set the email tied to your Carrot Mails account, subscription, and mailbox access." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const get = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => get() });

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (data) {
      setEmail(data.email ?? "");
      setDisplayName(data.display_name ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => update({ data: { email: email.trim(), display_name: displayName.trim() } }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppPage
      eyebrow="Account"
      title="Your profile"
      description="The email you set here is your account identity: subscription ownership, mailbox linking, access recovery, and signing in from another device."
    >
      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Loading…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="max-w-lg space-y-5"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium">Account email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20"
              placeholder="you@example.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              We use this for receipts, subscription updates, and to let you sign back in on another device.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Display name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20"
              placeholder="Ada Lovelace"
            />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-5">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {data?.complete ? "Profile complete" : "Profile incomplete"}
            </span>
            <Button type="submit" disabled={save.isPending || !email.trim() || !displayName.trim()}>
              {save.isPending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      )}
    </AppPage>
  );
}
