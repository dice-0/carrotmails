import { Instagram, Linkedin } from "lucide-react";

export const SOCIAL_LINKS = [
  { name: "Instagram", href: "https://www.instagram.com/carrotmails/", Icon: Instagram },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/carrotmails", Icon: Linkedin },
];

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {SOCIAL_LINKS.map(({ name, href, Icon }) => (
        <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Carrot Mails on ${name}`} className="hover:text-foreground">
          <Icon size={16} />
        </a>
      ))}
    </div>
  );
}
