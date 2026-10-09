'use client';

import { PageHeader } from '@/components/ui/misc';
import { ProfileForm } from '@/features/account/profile-form';

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Manage your personal information." />
      <ProfileForm />
    </>
  );
}
