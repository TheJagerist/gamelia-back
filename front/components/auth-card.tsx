import { LogoMark } from './ui';

export function AuthCard({ title, subtitle, children, aside }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="panel p-6 sm:p-8">
        <LogoMark className="mb-5 h-9 w-9" />
        <h1 className="text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {aside}
    </div>
  );
}
