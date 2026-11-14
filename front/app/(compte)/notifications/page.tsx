'use client';
import Link from 'next/link';
import { Award, Bell, Briefcase, CheckCircle2, MessageSquare, Users } from 'lucide-react';
import { useToast } from '@/components/toast';
import { Async, EmptyState, PageHeader, cx } from '@/components/ui';
import { api, messageFor } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useResource } from '@/lib/hooks';
import type { Notification } from '@/lib/types';

const ICON: Record<Notification['kind'], React.ComponentType<{ className?: string }>> = {
  reponse: MessageSquare,
  commentaire: MessageSquare,
  badge: Award,
  candidature: Briefcase,
  validation: CheckCircle2,
  collaboration: Users,
};

export default function NotificationsPage() {
  const res = useResource(() => api.notifications.list(), []);
  const toast = useToast();
  const unread = res.data?.filter((n) => !n.read).length ?? 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Réponses, commentaires, badges et candidatures."
        actions={
          unread > 0 && (
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  await api.notifications.markAllRead();
                  res.mutate((list) => list.map((n) => ({ ...n, read: true })));
                  toast('Toutes les notifications sont marquées comme lues.');
                } catch (e) {
                  toast(messageFor(e), 'error');
                }
              }}
            >
              Tout marquer comme lu
            </button>
          )
        }
      />
      <Async res={res} isEmpty={(d) => d.length === 0} empty={<EmptyState icon={<Bell className="h-10 w-10" />} title="Aucune notification." text="Vous serez prévenu ici quand quelqu'un répond à vos questions ou commente vos projets." />}>
        {(list) => (
          <ul className="panel divide-y divide-line">
            {list.map((n) => {
              const Icon = ICON[n.kind];
              return (
                <li key={n.id}>
                  <Link href={n.href} className={cx('flex gap-3 px-4 py-4 hover:bg-sunken sm:px-5', !n.read && 'bg-primary-soft/50')}>
                    <span className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', n.kind === 'badge' ? 'bg-accent-soft text-accent-ink' : 'bg-sunken text-primary')}>
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('block', !n.read && 'font-semibold')}>{n.text}</span>
                      <span className="text-[13px] text-muted">{timeAgo(n.date)}</span>
                    </span>
                    {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Non lue" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
    </>
  );
}
