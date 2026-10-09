'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, LifeBuoy, Mail } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { SectionHeading } from '@/components/marketing/sections';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form';
import { api, ApiError, errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  email: z.string().trim().email('Enter a valid email address'),
  subject: z.string().trim().min(3, 'Subject is too short').max(200),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000),
});
type Values = z.infer<typeof schema>;

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post('/public/contact', values);
      setSent(true);
      form.reset();
    } catch (err) {
      if (!(err instanceof ApiError && applyServerErrors(err, form.setError))) toast.error(errorMessage(err));
    }
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <SectionHeading eyebrow="Contact & support" title="We’d love to hear from you" text="Questions, feedback or a bug report? Send us a message." />
      <div className="mt-12 grid gap-8 lg:grid-cols-5">
        <aside className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <Mail className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold text-fg">Email</h2>
            <p className="mt-1 text-sm text-muted">support@neurotask.app</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <LifeBuoy className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold text-fg">Account help</h2>
            <p className="mt-1 text-sm text-muted">Forgot your password? Use the reset link on the login page — it arrives within a minute.</p>
          </div>
        </aside>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm lg:col-span-3">
          {sent ? (
            <div className="py-10 text-center" role="status">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold text-fg">Message sent</h2>
              <p className="mt-1 text-sm text-muted">Thanks for reaching out — we’ll get back to you soon.</p>
              <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
                Send another
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" required autoComplete="name" {...register('name')} error={formState.errors.name?.message} />
                <Input label="Email" type="email" required autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
              </div>
              <Input label="Subject" required {...register('subject')} error={formState.errors.subject?.message} />
              <Textarea label="Message" required rows={6} {...register('message')} error={formState.errors.message?.message} />
              <Button type="submit" loading={formState.isSubmitting} className="w-full sm:w-auto">
                Send message
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
