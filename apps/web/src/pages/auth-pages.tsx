import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { APP_LANGUAGES, loginSchema, type PublicUser } from '@mandimitra/shared';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/states';
import type { ApiError } from '@/lib/api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type AuthResponse = { token: string; user: PublicUser };

function useAuthSuccess() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (r: AuthResponse) => {
    signIn(r.token, r.user);
    navigate((location.state as { from?: string } | null)?.from ?? '/app', { replace: true });
  };
}

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/"><Logo /></Link>
        <main className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-ink-soft">{footer}</div>
        </main>
      </div>
      <div className="hidden bg-mandi-800 lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div className="slip-ruled max-w-md rounded-slip bg-white p-6 text-ink shadow-xl">
          <p className="text-xs text-ink-faint">Heard</p>
          <p className="mt-1 leading-[44px]">“40 quintal gehu, 2380 ka bhav, do percent aadhat”</p>
          <div className="mt-2 flex justify-between border-t border-line pt-3 text-sm"><span>Net payable</span><span className="tabular font-semibold text-mandi-700">₹93,296.00</span></div>
        </div>
        <p className="mt-6 max-w-md text-sm text-mandi-100">Every amount is calculated on the server and read back to you before anything is saved.</p>
      </div>
    </div>
  );
}

function DemoButton() {
  const onSuccess = useAuthSuccess();
  const demo = useMutation({ mutationFn: () => api.post<AuthResponse>('/api/auth/demo'), onSuccess });
  return (
    <>
      <Button type="button" variant="secondary" className="w-full" onClick={() => demo.mutate()} disabled={demo.isPending}>
        {demo.isPending && <Loader2 className="animate-spin" />} Try the demo account
      </Button>
      <p className="mt-1.5 text-center text-xs text-ink-faint">Synthetic sample data, shared by everyone who tries the demo.</p>
      {demo.error && <div className="mt-2"><ErrorState message={(demo.error as ApiError).message} /></div>}
    </>
  );
}

export function LoginPage() {
  const onSuccess = useAuthSuccess();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const login = useMutation({ mutationFn: (v: z.infer<typeof loginSchema>) => api.post<AuthResponse>('/api/auth/login', v), onSuccess });
  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Your records are where you left them." footer={<>New here? <Link to="/register" className="font-medium text-mandi-700 hover:underline">Create an account</Link></>}>
      <form onSubmit={handleSubmit((v) => login.mutate(v))} className="space-y-4" noValidate>
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="mt-1.5" {...register('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} /><FieldError id="email-error" message={errors.email?.message} /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" className="mt-1.5" {...register('password')} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} /><FieldError id="password-error" message={errors.password?.message} /></div>
        {login.error && <ErrorState message={(login.error as ApiError).message} />}
        <Button type="submit" className="w-full" size="lg" disabled={login.isPending}>{login.isPending && <Loader2 className="animate-spin" />} Sign in</Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-ink-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <DemoButton />
    </AuthLayout>
  );
}

const registerForm = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['farmer', 'trader']),
  preferredLanguage: z.string(),
});

export function RegisterPage() {
  const onSuccess = useAuthSuccess();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof registerForm>>({
    resolver: zodResolver(registerForm), defaultValues: { role: 'farmer', preferredLanguage: 'hi' },
  });
  const signup = useMutation({ mutationFn: (v: z.infer<typeof registerForm>) => api.post<AuthResponse>('/api/auth/register', v), onSuccess });
  return (
    <AuthLayout title="Create your account" subtitle="Takes a minute. You can change your language later." footer={<>Already registered? <Link to="/login" className="font-medium text-mandi-700 hover:underline">Sign in</Link></>}>
      <form onSubmit={handleSubmit((v) => signup.mutate(v))} className="space-y-4" noValidate>
        <div><Label htmlFor="name">Full name</Label><Input id="name" autoComplete="name" className="mt-1.5" {...register('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} /><FieldError id="name-error" message={errors.name?.message} /></div>
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="mt-1.5" {...register('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} /><FieldError id="email-error" message={errors.email?.message} /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" className="mt-1.5" {...register('password')} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} /><FieldError id="password-error" message={errors.password?.message} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="role">I am a</Label><Select id="role" className="mt-1.5" {...register('role')}><option value="farmer">Farmer</option><option value="trader">Trader</option></Select></div>
          <div><Label htmlFor="lang">Language</Label><Select id="lang" className="mt-1.5" {...register('preferredLanguage')}>{APP_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select></div>
        </div>
        {signup.error && <ErrorState message={(signup.error as ApiError).message} />}
        <Button type="submit" className="w-full" size="lg" disabled={signup.isPending}>{signup.isPending && <Loader2 className="animate-spin" />} Create account</Button>
      </form>
    </AuthLayout>
  );
}
