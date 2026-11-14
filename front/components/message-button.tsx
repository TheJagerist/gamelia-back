import Link from 'next/link';
import { MessageSquare } from 'lucide-react';

// Ouvre la messagerie sur la conversation avec ce membre (ou en crée une au premier message).
export function MessageButton({ username, className = 'btn btn-sm' }: { username: string; className?: string }) {
  return (
    <Link href={`/messages?avec=${encodeURIComponent(username)}`} className={className}>
      <MessageSquare className="h-4 w-4" aria-hidden />
      Écrire
    </Link>
  );
}
