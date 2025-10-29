/**
 * Sign In Page
 * Uses Clerk's pre-built SignIn component
 */

'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <SignIn />
    </div>
  );
}
