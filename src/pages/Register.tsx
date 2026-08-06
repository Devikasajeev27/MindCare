import React, { useState } from 'react';
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Lock, Eye, EyeOff, Phone, User, Calendar, Shield, Activity, BarChart2, AlertTriangle, ChevronLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { MindCareLogo } from '@/components/MindCareLogo';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

import { PhoneInput, isValidPhoneNumber, getPhoneDetails } from "@/components/ui/PhoneInput";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/context/CountryContext";

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().refine(val => isValidPhoneNumber(val), {
    message: 'Please enter a valid international phone number',
  }),
  age: z.string().min(1, 'Age is required'),
  panCard: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN in the format ABCDE1234F'),
  gender: z.string().min(1, 'Gender is required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
  emergencyName: z.string().min(2, 'Emergency contact name is required'),
  emergencyPhone: z.string().refine(val => isValidPhoneNumber(val), {
    message: 'Please enter a valid international phone number',
  }),
  emergencyRelation: z.string().min(1, 'Relationship is required'),
  terms: z.boolean().refine(v => v === true, 'You must accept the terms'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const FEATURES = [
  { icon: Shield, text: 'HIPAA-compliant data security' },
  { icon: Activity, text: '24/7 AI emotional support' },
  { icon: BarChart2, text: 'Personalised mood & progress tracking' },
  { icon: CheckCircle2, text: 'Verified licensed therapists' },
];

export default function Register() {
  const [, setLocation] = useLocation();
  const [showPwd, setShowPwd] = useState(false);
  const [showCPwd, setShowCPwd] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '', email: '', phone: '', age: '', panCard: '', gender: '',
      password: '', confirmPassword: '',
      emergencyName: '', emergencyPhone: '', emergencyRelation: '',
      terms: false,
    },
  });

  async function onSubmit(data: z.infer<typeof registerSchema>) {
    setIsSubmitting(true);
    try {
      const phoneDetails = getPhoneDetails(data.phone);
      const countryDetails = COUNTRIES.find(c => c.code === phoneDetails?.countryCode) || DEFAULT_COUNTRY;

      const payload = {
        ...data,
        country: countryDetails.name,
        countryCode: countryDetails.code,
        dialCode: countryDetails.dialCode,
        phoneNumber: phoneDetails?.internationalFormat || data.phone,
        currency: countryDetails.currency,
        currencyCode: countryDetails.currencyCode,
        preferredLocale: countryDetails.locale,
        phoneVerified: true
      };

      await register({ ...payload, panNumber: payload.panCard.trim().toUpperCase() });
      toast({
        title: "Registration Successful!",
        description: "Your MindCare account has been created.",
      });
      setLocation('/dashboard');
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: err.message || "Failed to create account. Please check your details.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: photo + brand ───────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden flex-col">
        <img
          src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=1200"
          alt="Wellness"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950/90 via-gray-900/75 to-primary/35" />

        <div className="relative z-10 flex flex-col h-full px-10 py-10">
          <Link href="/">
            <MindCareLogo size="md" theme="dark" className="cursor-pointer" />
          </Link>

          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-white text-2xl font-extrabold leading-snug mb-3">
              Start your journey to better mental well-being
            </h2>
            <p className="text-white/55 text-sm leading-relaxed mb-8">
              Join over 10,000 people who have taken control of their mental health with MindCare's AI-powered platform.
            </p>

            <div className="space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-white/75 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/25 text-[11px]">© 2025 MindCare. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right panel: form ───────────────────────────── */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="min-h-full flex items-start justify-center px-6 sm:px-10 py-10">
          <div className="w-full max-w-[480px]">

            {/* Mobile logo */}
            <div className="lg:hidden mb-6">
              <Link href="/">
                <MindCareLogo size="md" className="cursor-pointer" />
              </Link>
            </div>

            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 font-medium mb-6 hover:text-primary transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back to Sign In
            </Link>

            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">Create your account</h1>
            <p className="text-sm text-gray-500 mb-7">Fill in your details below to get started with MindCare.</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Dummy hidden inputs to absorb browser autofill */}
                <input type="text" name="chrome-autofill-dummy-username" style={{ display: 'none' }} autoComplete="username" tabIndex={-1} aria-hidden="true" />
                <input type="password" name="chrome-autofill-dummy-password" style={{ display: 'none' }} autoComplete="new-password" tabIndex={-1} aria-hidden="true" />

                {/* ─── Personal Information ─── */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Personal Information</p>
                  <div className="space-y-4">

                    <FormField control={form.control} name="fullName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Full Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="Your full name" {...field} className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="you@example.com" {...field} autoComplete="off" className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Phone Number</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Enter phone number"
                            error={!!form.formState.errors.phone}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="panCard" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">PAN Card Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="ABCDE1234F" {...field} maxLength={10} autoCapitalize="characters" autoComplete="off" onChange={(event) => field.onChange(event.target.value.toUpperCase())} className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="age" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700">Age</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input type="number" placeholder="Age" {...field} className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700">Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 rounded-lg border-gray-200 bg-gray-50 text-sm">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="non-binary">Non-binary</SelectItem>
                              <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </div>

                {/* ─── Emergency Contact ─── */}
                <div className="pt-1">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Emergency Contact</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5 mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 leading-snug">
                      Required for your safety. In the event of a mental health emergency, we may contact this person on your behalf.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <FormField control={form.control} name="emergencyName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Contact Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="Emergency contact full name" {...field} className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 text-sm" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="emergencyPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Contact Phone</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Emergency contact phone number"
                            error={!!form.formState.errors.emergencyPhone}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="emergencyRelation" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Relationship</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-lg border-gray-200 bg-gray-50 text-sm">
                              <SelectValue placeholder="Select relation" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                            <SelectItem value="spouse">Spouse / Partner</SelectItem>
                            <SelectItem value="friend">Close Friend</SelectItem>
                            <SelectItem value="guardian">Guardian</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* ─── Password ─── */}
                <div className="pt-1">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Set Password</p>
                  <div className="space-y-4">
                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input type={showPwd ? 'text' : 'password'} placeholder="Create a strong password" {...field}
                              autoComplete="new-password"
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

                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input type={showCPwd ? 'text' : 'password'} placeholder="Re-enter your password" {...field}
                              autoComplete="new-password"
                              className="pl-10 pr-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                            <button type="button" onClick={() => setShowCPwd(!showCPwd)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showCPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Terms */}
                <FormField control={form.control} name="terms" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-1">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5 border-gray-300" />
                    </FormControl>
                    <FormLabel className="text-sm text-gray-500 font-normal leading-snug">
                      I agree to the{' '}
                      <a href="#" className="text-primary font-semibold hover:underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" className="text-primary font-semibold hover:underline">Privacy Policy</a>
                    </FormLabel>
                  </FormItem>
                )} />

                <Button type="submit" disabled={isSubmitting}
                  className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-primary hover:underline">Sign in</Link>
              {' · '}
              <Link href="/register-therapist" className="font-bold text-primary hover:underline">Join as Therapist</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
