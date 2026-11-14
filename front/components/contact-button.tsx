'use client';
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { api, messageFor } from '@/lib/api';
import { useToast } from './toast';
import { Dialog, TextArea } from './ui';

export function ContactButton({ username, name, className = 'btn' }: { username: string; name: string; className?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <Mail className="h-4 w-4" aria-hidden />
        Contacter
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Contacter ${name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button
              className="btn"
              disabled={busy || msg.trim().length < 20}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.recruiter.contact(username, msg);
                  toast(`Message envoyé à ${name}.`);
                  setOpen(false);
                  setMsg('');
                } catch (e) {
                  toast(messageFor(e), 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Envoi…' : 'Envoyer le message'}
            </button>
          </>
        }
      >
        <TextArea label="Votre message" hint="Présentez le poste ou la mission, et la suite proposée. Au moins 20 caractères." rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} counter={600} />
      </Dialog>
    </>
  );
}
