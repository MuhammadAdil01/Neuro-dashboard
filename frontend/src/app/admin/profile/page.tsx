'use client';

import { PageHeader } from '@/components/ui/misc';
import { ProfileForm } from '@/features/account/profile-form';
import { SecurityCard } from '@/features/account/security-card';

export default function AdminProfilePage() {
  return (
    <>
      <PageHeader title="Profile & security" description="Your administrator account." />
      <div className="space-y-6">
        <ProfileForm />
        <div className="max-w-3xl">
          <SecurityCard />
        </div>
      </div>
    </>
  );
}
