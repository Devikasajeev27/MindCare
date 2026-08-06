import React, { useState } from 'react';
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Lock, Eye, EyeOff, Phone, User, FileText, Shield, UploadCloud, Award, Calendar, Users, ChevronLeft, Stethoscope, ArrowRight, CheckCircle2 } from 'lucide-react';
import { MindCareLogo } from '@/components/MindCareLogo';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/PhoneInput";

const schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().refine(val => isValidPhoneNumber(val), {
    message: 'Please enter a valid international phone number',
  }),
  qualification: z.string().min(2, 'Qualification required'),
  specialization: z.string().min(1, 'Specialization required'),
  experience: z.string().min(1, 'Experience required'),
  licenseNumber: z.string().min(2, 'License number required'),
  panNumber: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN in the format ABCDE1234F'),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(v => v === true, 'You must accept the terms'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const BENEFITS = [
  { icon: Shield, text: "Secure digital practice space with full HIPAA compliance standards" },
  { icon: Users, text: "Direct connections with users seeking support matching your specialization" },
  { icon: FileText, text: "Integrated clinical documentation, session logs, and mood tracking" },
  { icon: Award, text: "Recognition badges and review systems to build your digital presence" },
];

export default function RegisterTherapist() {
  const [, setLocation] = useLocation();
  const [showPwd, setShowPwd] = useState(false);
  const [showCPwd, setShowCPwd] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegisteredPending, setIsRegisteredPending] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '', email: '', phone: '', qualification: '',
      specialization: '', experience: '', licenseNumber: '',
      panNumber: '',
      password: '', confirmPassword: '', terms: false,
    },
  });

  async function onSubmit(data: z.infer<typeof schema>) {
    setIsSubmitting(true);
    try {
      await register({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: "therapist",
        qualification: data.qualification,
        specialization: data.specialization,
        experience: data.experience,
        licenseNumber: data.licenseNumber,
        panNumber: data.panNumber.trim().toUpperCase(),
      });

      setIsRegisteredPending(true);
      toast({
        title: "Registration Submitted!",
        description: "Your therapist application is pending administrator review.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: err.message || "Failed to create therapist account.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isRegisteredPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-amber-600 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Application Under Review</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Thank you, Dr. {form.getValues("fullName")}. Your professional therapist account has been successfully created and is now **awaiting administrator approval**.
          </p>
          <div className="bg-amber-50/50 text-amber-700 border border-amber-100 rounded-2xl p-4 text-xs text-left leading-relaxed">
            <strong>Verification Process:</strong> We verify all credentials and license numbers (e.g. License #{form.getValues("licenseNumber")}) within 1–2 business days. You will receive an email and notification once your account is active.
          </div>
          <Link href="/login" className="block w-full bg-primary text-white py-3 rounded-xl font-semibold shadow-md shadow-primary/20 hover:bg-primary/95 transition-all text-center text-sm">
            Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: photo + brand ───────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden flex-col">
        <img
          src="https://images.unsplash.com/photo-1551836022-4c4c79ecde51?auto=format&fit=crop&q=80&w=1200"
          alt="Professional therapy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950/90 via-gray-900/75 to-primary/30" />

        <div className="relative z-10 flex flex-col h-full px-10 py-10">
          <Link href="/">
            <MindCareLogo size="md" theme="dark" className="cursor-pointer" />
          </Link>

          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-white text-2xl font-extrabold leading-snug mb-3">
              Join MindCare as a licensed mental health professional
            </h2>
            <p className="text-white/55 text-sm leading-relaxed mb-8">
              Expand your practice, connect with patients who need you, and make a lasting difference through our secure, professional platform.
            </p>

            <div className="space-y-3">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-white/75 text-sm">{text}</span>
                </div>
              ))}
            </div>

            {/* Verification note */}
            <div className="mt-8 border border-white/15 rounded-xl p-4 bg-white/5 backdrop-blur-sm">
              <p className="text-white/80 text-xs font-semibold mb-1">Verification Process</p>
              <p className="text-white/45 text-xs leading-relaxed">
                All therapist accounts are manually reviewed within 1–2 business days. Your credentials and license are verified before activation.
              </p>
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

            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">Therapist Registration</h1>
                <p className="text-sm text-gray-500 mt-0.5">Apply to join the MindCare professional network</p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Dummy hidden inputs to absorb browser autofill */}
                <input type="text" name="chrome-autofill-dummy-username" style={{ display: 'none' }} autoComplete="username" tabIndex={-1} aria-hidden="true" />
                <input type="password" name="chrome-autofill-dummy-password" style={{ display: 'none' }} autoComplete="new-password" tabIndex={-1} aria-hidden="true" />

                {/* ─── Professional Details ─── */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Professional Details</p>
                  <div className="space-y-4">

                    <FormField control={form.control} name="fullName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Full Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="Dr. First Last" {...field} className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Professional Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="doctor@clinic.com" {...field} autoComplete="off" className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
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

                    <FormField control={form.control} name="qualification" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Qualification</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="PhD, PsyD, LCSW…" {...field} className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="specialization" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700">Specialization</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 rounded-lg border-gray-200 bg-gray-50 text-sm">
                                <SelectValue placeholder="Select area" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="anxiety">Anxiety & Depression</SelectItem>
                              <SelectItem value="cbt">CBT</SelectItem>
                              <SelectItem value="couples">Couples Counselling</SelectItem>
                              <SelectItem value="trauma">Trauma & PTSD</SelectItem>
                              <SelectItem value="addiction">Addiction Recovery</SelectItem>
                              <SelectItem value="child">Child Psychology</SelectItem>
                              <SelectItem value="grief">Grief & Bereavement</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="experience" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700">Years of Experience</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input placeholder="e.g. 8" {...field} className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">License / Registration Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="Your professional license number" {...field} className="pl-10 h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-primary text-sm" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="panNumber" render={({ field }) => (
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

                    {/* Document uploads */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-dashed border-gray-200 bg-gray-50 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors group">
                        <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-primary mb-1.5 transition-colors" />
                        <p className="text-xs font-semibold text-gray-600">Upload Certificate</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">PDF, JPG · max 5 MB</p>
                      </div>
                      <div className="border border-dashed border-gray-200 bg-gray-50 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors group">
                        <User className="w-5 h-5 text-gray-400 group-hover:text-primary mb-1.5 transition-colors" />
                        <p className="text-xs font-semibold text-gray-600">Profile Photo</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG · max 2 MB</p>
                      </div>
                    </div>
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

                {/* Verification notice */}
                <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-lg">
                  <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">Manual Verification Required</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Your credentials will be verified by our clinical team within 1–2 business days before your account is activated.
                    </p>
                  </div>
                </div>

                {/* Terms */}
                <FormField control={form.control} name="terms" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
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

                <Button type="submit"
                  className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                  Submit Application <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-primary hover:underline">Sign in</Link>
              {' · '}
              <Link href="/register" className="font-bold text-primary hover:underline">Register as User</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
