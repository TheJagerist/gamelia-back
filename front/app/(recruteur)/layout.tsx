import { RoleGuard } from '@/components/guard';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleGuard roles={['recruteur']}>{children}</RoleGuard>;
}
