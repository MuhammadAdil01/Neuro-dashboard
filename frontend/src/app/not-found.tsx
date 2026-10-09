import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-2xl font-bold text-fg">Page not found</h1>
      <p className="max-w-sm text-muted">The page you’re looking for doesn’t exist or has been moved.</p>
      <ButtonLink href="/" className="mt-4">
        Go home
      </ButtonLink>
    </div>
  );
}
