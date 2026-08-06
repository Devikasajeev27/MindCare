import React, { useState } from 'react';
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Lock, Eye, EyeOff, Shield, ArrowRight,
  Copy, Check, Users, Stethoscope, ShieldCheck, LogIn,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { MindCareLogo } from '@/components/MindCareLogo';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const STATS = [
  { value: '10,000+', label: 'Users supported' },
  { value: '500+',    label: 'Certified therapists' },
  { value: '4.9 / 5', label: 'Average rating' },
];

const DEMO_ACCOUNTS = [
  {
    type: 'User',
    email: 'alex@mindcare.com',
    password: 'password123',
    description: 'Access AI support & therapy sessions',
    icon: Users,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
    badgeClass: 'bg-blue-100 text-blue-700',
    redirectTo: '/dashboard',
  },
  {
    type: 'Therapist',
    email: 'sarah@mindcare.com',
    password: 'password123',
    description: 'View your patient sessions & schedule',
    icon: Stethoscope,
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100',
    badgeClass: 'bg-purple-100 text-purple-700',
    redirectTo: '/therapist/dashboard',
  },
  {
    type: 'Admin',
    email: 'admin@mindcare.com',
    password: 'password123',
    description: 'Platform management & analytics',
    icon: ShieldCheck,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-100',
    badgeClass: 'bg-green-100 text-green-700',
    redirectTo: '/admin/dashboard',
  },
] as const;

type DemoAccount = typeof DEMO_ACCOUNTS[number];

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  function getRedirectPath(role: string): string {
    if (role === 'therapist') return '/therapist/dashboard';
    if (role === 'admin') return '/admin/dashboard';
    return '/dashboard';
  }

  async function onSubmit(data: z.infer<typeof loginSchema>) {
    setIsSubmitting(true);
    try {
      const user = await login(data);
      toast({
        title: "Welcome back!",
        description: "Successfully signed in.",
      });
      const dest = getRedirectPath((user as any)?.role || 'user');
      setLocation(dest, { replace: true });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: err.message || "Invalid credentials. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loginAsDemo(account: DemoAccount) {
    setDemoLoading(account.type);
    // Fill the form visually so the user can see what's being used
    form.setValue('email', account.email);
    form.setValue('password', account.password);
    try {
      const user = await login({ email: account.email, password: account.password });
      toast({
        title: `Signed in as ${account.type}`,
        description: `Welcome! Redirecting to ${account.type.toLowerCase()} dashboard.`,
      });
      const dest = getRedirectPath((user as any)?.role || 'user');
      setLocation(dest, { replace: true });
    } catch (err: any) {
      const isServerDown = err?.status === 0 || err?.status === 502 ||
        (err?.message || '').toLowerCase().includes('cannot connect') ||
        (err?.message || '').toLowerCase().includes('failed to fetch');

      const isDbDown = err?.status === 503 ||
        (err?.message || '').toLowerCase().includes('database not connected');

      toast({
        variant: "destructive",
        title: isDbDown ? "Database Offline" : isServerDown ? "Server Offline" : "Demo login failed",
        description: isDbDown
          ? "MongoDB is not running. In your terminal, run: npm install --save-dev mongodb-memory-server && npm run dev"
          : isServerDown
          ? "The backend server is not running. Please start it with: npm run dev"
          : err.message || "Could not sign in with demo account. Please try again.",
      });
    } finally {
      setDemoLoading(null);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function fillForm(email: string, password: string) {
    form.setValue('email', email);
    form.setValue('password', password);
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: photo + brand ───────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col">
        {/* Background photo */}
        <img
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=1400"
          alt="Peaceful nature"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950/85 via-gray-900/70 to-primary/40" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <Link href="/">
            <MindCareLogo size="md" theme="dark" className="cursor-pointer" />
          </Link>

          <div className="flex-1 flex flex-col justify-center max-w-md">
            <div className="text-white/40 text-5xl font-serif leading-none mb-5">"</div>
            <blockquote className="text-white text-2xl font-semibold leading-snug mb-4">
              Your mental health is just as important as your physical health.
            </blockquote>
            <p className="text-white/60 text-sm leading-relaxed mb-10">
              MindCare brings together AI-powered support, peer companions, and professional therapists to guide you toward lasting well-being.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {STATS.map(s => (
                <div key={s.label} className="border border-white/15 rounded-2xl px-4 py-3 bg-white/5 backdrop-blur-sm">
                  <div className="text-white font-extrabold text-lg leading-none mb-1">{s.value}</div>
                  <div className="text-white/50 text-[11px] leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Shield className="w-3.5 h-3.5 text-primary/60" />
            <span>HIPAA compliant · End-to-end encrypted · Clinically validated</span>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ───────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center bg-white px-6 sm:px-12 lg:px-14 py-12 overflow-y-auto">
        <div className="w-full max-w-[420px] mx-auto">

          {/* Mobile-only logo */}
          <div className="lg:hidden mb-8">
            <Link href="/">
              <MindCareLogo size="md" className="cursor-pointer" />
            </Link>
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight">Sign in to MindCare</h1>
          <p className="text-sm text-gray-500 mb-8">Welcome back. Please enter your credentials to continue.</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" autoComplete="off">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-700">Email address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input placeholder="you@example.com" {...field} autoComplete="off"
                        className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between mb-1">
                    <FormLabel className="text-sm font-semibold text-gray-700 mb-0">Password</FormLabel>
                    <Link href="/forgot-password" className="text-xs text-primary font-semibold hover:underline">Forgot password?</Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input type={showPwd ? 'text' : 'password'} placeholder="••••••••" {...field} autoComplete="new-password"
                        className="pl-10 pr-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={v => setRemember(!!v)} className="border-gray-300" />
                <label htmlFor="remember" className="text-sm text-gray-500 cursor-pointer select-none">Keep me signed in</label>
              </div>

              <Button type="submit" disabled={isSubmitting}
                className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </form>
          </Form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400 font-medium">or sign in with</span></div>
          </div>

          {/* Social */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-10 rounded-lg border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </Button>
            <Button variant="outline" className="h-10 rounded-lg border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Apple
            </Button>
          </div>

          {/* ── Demo Accounts ──────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/[0.03] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDemo(!showDemo)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/[0.05] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <LogIn className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">Try a demo account</p>
                  <p className="text-[11px] text-gray-400">No sign-up needed · password: password123</p>
                </div>
              </div>
              {showDemo
                ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              }
            </button>

            {showDemo && (
              <div className="px-3 pb-3 space-y-2 border-t border-primary/10 pt-3">
                {DEMO_ACCOUNTS.map((account) => {
                  const Icon = account.icon;
                  const isLoading = demoLoading === account.type;
                  return (
                    <div
                      key={account.type}
                      className={`rounded-xl border ${account.borderColor} ${account.bgColor} p-3`}
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                          <Icon className={`w-4 h-4 ${account.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-800">{account.type}</p>
                            <Badge className={`text-[10px] px-1.5 py-0 border-0 font-semibold ${account.badgeClass}`}>
                              {account.type}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">{account.description}</p>
                        </div>
                      </div>

                      {/* Email row */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 bg-white rounded-lg border border-gray-200 px-2.5 py-1.5 flex items-center gap-2 min-w-0">
                          <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-600 font-mono truncate">{account.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(account.email, `email-${account.type}`)}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-primary/30 hover:bg-primary/5 transition-colors shrink-0"
                          title="Copy email"
                        >
                          {copied === `email-${account.type}`
                            ? <Check className="w-3 h-3 text-green-500" />
                            : <Copy className="w-3 h-3 text-gray-400" />
                          }
                        </button>
                        <button
                          type="button"
                          onClick={() => fillForm(account.email, account.password)}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-primary/30 hover:bg-primary/5 transition-colors shrink-0"
                          title="Fill form"
                        >
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>

                      {/* Password row */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="flex-1 bg-white rounded-lg border border-gray-200 px-2.5 py-1.5 flex items-center gap-2 min-w-0">
                          <Lock className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-400 font-mono">password123</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(account.password, `pwd-${account.type}`)}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-primary/30 hover:bg-primary/5 transition-colors shrink-0"
                          title="Copy password"
                        >
                          {copied === `pwd-${account.type}`
                            ? <Check className="w-3 h-3 text-green-500" />
                            : <Copy className="w-3 h-3 text-gray-400" />
                          }
                        </button>
                        <div className="w-7 h-7 shrink-0" /> {/* spacer */}
                      </div>

                      {/* Login button */}
                      <button
                        type="button"
                        onClick={() => loginAsDemo(account)}
                        disabled={isLoading || !!demoLoading}
                        className={`w-full h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all
                          ${account.type === 'User'      ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
                          ${account.type === 'Therapist' ? 'bg-purple-500 hover:bg-purple-600 text-white' : ''}
                          ${account.type === 'Admin'     ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                          disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {isLoading ? (
                          <>
                            <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            <LogIn className="w-3 h-3" />
                            Login as {account.type}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Register CTA */}
          <div className="mt-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-3 text-center">Don't have an account?</p>
            <div className="space-y-2">
              <Link href="/register"
                className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Register as User</p>
                  <p className="text-[11px] text-gray-400">Access AI support &amp; therapy sessions</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
              <Link href="/register-therapist"
                className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Register as Therapist</p>
                  <p className="text-[11px] text-gray-400">Join as a mental health professional</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3 text-primary/50" />
            Protected by 256-bit encryption · HIPAA compliant
          </p>
        </div>
      </div>
    </div>
  );
}
