'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { ConversationList, NewConversation, ThreadView } from '@/components/chat';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useQueryState, useResource } from '@/lib/hooks';

// /messages            -> liste des conversations
// /messages?c=ID       -> une conversation ouverte
// /messages?avec=PSEUDO -> écrire à un membre (ouvre la conversation si elle existe déjà)
export default function MessagesPage() {
  const router = useRouter();
  const qs = useQueryState();
  const list = useResource(() => api.messages.list(), [], qs.ready);
  const c = qs.get('c');
  const avec = qs.get('avec');

  const existing = avec && list.data ? list.data.find((x) => x.with.username === avec) : undefined;
  const activeId = c || existing?.id || undefined;
  const newWith = !activeId && avec && list.data ? avec : undefined;
  const waitingForList = !c && !!avec && !list.data && !list.error;
  const hasSelection = Boolean(activeId || newWith || waitingForList);

  return (
    <>
      <PageHeader title="Messages" description="Vos conversations privées avec les autres membres." />

      <div className="panel grid overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside aria-label="Conversations" className={cx('max-h-[min(70vh,640px)] overflow-y-auto border-line lg:border-r', hasSelection && 'hidden lg:block')}>
          {list.loading && !list.data ? (
            <div className="p-3">
              <ListSkeleton rows={4} />
            </div>
          ) : list.error ? (
            <div className="p-3">
              <ErrorState error={list.error} onRetry={list.reload} />
            </div>
          ) : list.data && list.data.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<MessageSquare className="h-10 w-10" />}
                title="Aucune conversation."
                text="Ouvrez le profil d'un membre et choisissez « Écrire » pour commencer."
                action={
                  <Link href="/classement" className="btn btn-secondary btn-sm">
                    Voir les membres
                  </Link>
                }
              />
            </div>
          ) : (
            <ConversationList items={list.data ?? []} activeId={activeId} />
          )}
        </aside>

        <section aria-label="Discussion" className={cx('min-w-0', !hasSelection && 'hidden lg:block')}>
          {activeId ? (
            <ThreadView id={activeId} onChanged={list.reload} />
          ) : newWith ? (
            <NewConversation
              username={newWith}
              onCreated={(id) => {
                list.reload();
                router.replace(`/messages?c=${id}`);
              }}
            />
          ) : waitingForList ? (
            <div className="p-4">
              <ListSkeleton rows={2} />
            </div>
          ) : (
            <div className="p-6">
              <EmptyState icon={<MessageSquare className="h-10 w-10" />} title="Choisissez une conversation." text="Vos messages s'afficheront ici." />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
