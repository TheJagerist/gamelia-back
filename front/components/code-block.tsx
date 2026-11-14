'use client';
// Coloration syntaxique légère (prism-react-renderer, licence MIT), chargée seulement sur les pages qui affichent du code.
// Les jetons sont rendus comme éléments React : aucun HTML brut n'est injecté.
import { Highlight, type PrismTheme } from 'prism-react-renderer';

const theme: PrismTheme = {
  plain: { color: '#f6ecf3', backgroundColor: '#2a1730' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#b49bb0', fontStyle: 'italic' } },
    { types: ['keyword', 'boolean', 'important', 'atrule'], style: { color: '#e7b6d6' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: { color: '#f3ccde' } },
    { types: ['number', 'constant', 'symbol'], style: { color: '#f5b3a0' } },
    { types: ['function', 'class-name', 'selector'], style: { color: '#b9e4cf' } },
    { types: ['tag', 'property', 'attr-name'], style: { color: '#e7b6d6' } },
    { types: ['punctuation', 'operator'], style: { color: '#cdb9c9' } },
  ],
};

const ALIAS: Record<string, string> = { html: 'markup', js: 'javascript', ts: 'tsx', typescript: 'tsx', shell: 'bash', sh: 'bash', py: 'python' };

export default function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const language = ALIAS[lang] || lang;
  return (
    <figure className="my-3 overflow-hidden rounded-lg border border-[#4a3352]">
      <figcaption className="flex items-center justify-between bg-[#3a2342] px-3 py-1.5 text-xs font-semibold text-[#d9c2d4]">
        <span>{lang}</span>
        <CopyButton text={code} />
      </figcaption>
      <Highlight code={code.trimEnd()} language={language} theme={theme}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre style={style} className="overflow-x-auto p-4 text-[13.5px] leading-relaxed" tabIndex={0}>
            <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, k) => (
                    <span key={k} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </figure>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="rounded px-2 py-1 hover:bg-[#4a3352] hover:text-white"
      onClick={(e) => {
        const b = e.currentTarget;
        navigator.clipboard?.writeText(text).then(() => {
          b.textContent = 'Copié';
          setTimeout(() => (b.textContent = 'Copier'), 1500);
        });
      }}
    >
      Copier
    </button>
  );
}
