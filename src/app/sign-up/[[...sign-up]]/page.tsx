/**
 * Sign Up Page
 * Uses Clerk's pre-built SignUp component
 */

'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <SignUp />
    </div>
  );
}
