import { LoginForm } from '@/presentation/components/auth/LoginForm';

/**
 * Login page — full-screen centring shell only.
 * All form logic and visual design lives inside LoginForm.
 */
export default function LoginView() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <LoginForm />
    </div>
  );
}
