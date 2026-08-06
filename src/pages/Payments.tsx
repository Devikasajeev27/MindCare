import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2, Zap, Shield, CreditCard, ArrowRight,
  Download, RefreshCw, Loader2, Sparkles, Crown, Gift,
  Receipt, Clock, CheckCheck, AlertCircle, Info, X, XCircle, Wallet, Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/context/CurrencyContext';
import { api, ApiError } from '@/lib/api';
import { loadRazorpayScript, openRazorpayCheckout } from '@/lib/razorpay';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BillingPlan {
  _id: string;
  name: string;
  price: number;
  yearlyPrice?: number;
  period: string;
  description?: string;
  features: string[];
  notIncluded?: string[];
  popular: boolean;
  color: string;
  buttonClass: string;
  buttonText?: string;
}

interface PaymentRecord {
  _id: string;
  description: string;
  amount: number;
  status: 'success' | 'failed' | 'pending' | 'refunded';
  invoiceNumber: string;
  paymentMethod: string;
  type: string;
  createdAt: string;
  planId?: { name: string };
}

interface BillingData {
  plans: BillingPlan[];
  history: PaymentRecord[];
  currentPlan: BillingPlan | null;
  paymentMethod: { brand: string; label: string; expires: string } | null;
}

// ─── Pill icon mapping ────────────────────────────────────────────────────────
const PLAN_META: Record<string, { icon: React.ReactNode; gradient: string; accent: string; textAccent: string; badge?: string }> = {
  Free:         { icon: <Gift className="w-5 h-5" />,        gradient: 'from-slate-50 to-white',       accent: 'border-slate-200 dark:border-zinc-800',   textAccent: 'text-slate-600 dark:text-zinc-400', badge: 'Free' },
  Essential:    { icon: <Sparkles className="w-5 h-5" />,    gradient: 'from-blue-50/50 to-white',    accent: 'border-blue-300 dark:border-blue-800',   textAccent: 'text-blue-600 dark:text-blue-400',   badge: 'Starter' },
  Premium:      { icon: <Zap className="w-5 h-5" />,         gradient: 'from-emerald-50/60 to-white',  accent: 'border-emerald-300 dark:border-emerald-800', textAccent: 'text-emerald-600 dark:text-emerald-400', badge: 'Most Popular' },
  Professional: { icon: <Crown className="w-5 h-5" />,       gradient: 'from-violet-50/50 to-white',   accent: 'border-violet-300 dark:border-violet-800',  textAccent: 'text-violet-600 dark:text-violet-400', badge: 'Pro' },
};

const DEFAULT_PLANS: BillingPlan[] = [
  {
    _id: 'free',
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    period: 'forever',
    description: 'Allow new users to experience the platform without payment.',
    color: 'bg-slate-50 border-slate-200 dark:border-zinc-800',
    buttonClass: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200',
    buttonText: 'Get Started',
    features: [
      'Limited AI conversations per day',
      'Daily Mood Tracking',
      'Personal Journal',
      'Wellness Dashboard',
      'Basic Mood Analytics',
      'Community Mental Health Resources',
      'Emergency Crisis Detection',
      'Suicide Risk Detection',
      'Continuous Distress Monitoring',
      'Automatic Crisis Escalation',
      'Emergency Contact Alert (if enabled)',
      'AI Safety Monitoring'
    ],
    notIncluded: [
      'Therapist Chat',
      'Voice Consultation',
      'Video Consultation',
      'Advanced Analytics',
      'Family Sharing'
    ],
    popular: false,
  },
  {
    _id: 'essential',
    name: 'Essential',
    price: 299,
    yearlyPrice: 2999,
    period: 'month',
    description: 'Everything included in Free PLUS',
    color: 'bg-blue-50/40 border-blue-300 dark:border-blue-800',
    buttonClass: 'bg-blue-600 text-white hover:bg-blue-700',
    buttonText: 'Upgrade Now',
    features: [
      'Everything included in Free',
      'Unlimited AI Chat',
      'Unlimited Mood Tracking',
      'Guided Meditation Library',
      'Advanced Journal Analysis',
      'Personalized Wellness Insights',
      'Faster AI Responses'
    ],
    notIncluded: [
      'Therapist Chat',
      'Voice Consultation',
      'Video Consultation',
      'Advanced Analytics',
      'Family Sharing'
    ],
    popular: false,
  },
  {
    _id: 'premium',
    name: 'Premium',
    price: 699,
    yearlyPrice: 6999,
    period: 'month',
    description: 'Everything included in Essential PLUS',
    color: 'bg-emerald-50/60 border-emerald-300 dark:border-emerald-800 shadow-md',
    buttonClass: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md',
    buttonText: 'Choose Premium',
    features: [
      'Everything included in Essential',
      'Unlimited AI',
      'Voice AI Conversations',
      'Video AI Sessions',
      'Monthly Therapist Chat Credits',
      'Weekly Wellness Reports',
      'Family Access',
      'Advanced Mood Analytics',
      'Priority AI Queue'
    ],
    notIncluded: [
      'Unlimited Therapist Chat',
      'Dedicated Wellness Coach'
    ],
    popular: true,
  },
  {
    _id: 'professional',
    name: 'Professional',
    price: 1499,
    yearlyPrice: 14999,
    period: 'month',
    description: 'Everything included in Premium PLUS',
    color: 'bg-violet-50/40 border-violet-300 dark:border-violet-800',
    buttonClass: 'bg-violet-600 text-white hover:bg-violet-700',
    buttonText: 'Upgrade to Professional',
    features: [
      'Everything included in Premium',
      'Unlimited Therapist Chat',
      'Unlimited Voice Consultation',
      'Unlimited Video Consultation',
      'Dedicated Wellness Coach',
      'Priority Therapist Assignment',
      'Advanced AI Monitoring',
      'Unlimited Reports',
      'Corporate Wellness Features',
      'Highest Priority Support'
    ],
    notIncluded: [],
    popular: false,
  },
];

const CANONICAL_PLAN_NAMES = ['Free', 'Essential', 'Premium', 'Professional'];

function normalisePlanCatalogue(rawPlans: BillingPlan[] | undefined): BillingPlan[] {
  const byName = new Map<string, BillingPlan>();
  for (const plan of rawPlans || []) {
    if (!CANONICAL_PLAN_NAMES.includes(plan.name) || byName.has(plan.name) || !Number.isFinite(Number(plan.price)) || Number(plan.price) < 0) continue;
    byName.set(plan.name, plan);
  }
  const plans = CANONICAL_PLAN_NAMES.map(name => byName.get(name)).filter(Boolean) as BillingPlan[];
  return plans.length === CANONICAL_PLAN_NAMES.length ? plans : DEFAULT_PLANS;
}

const annualPrice = (monthlyPrice: number) => Math.round(monthlyPrice * 12 * 0.8);

function getPaymentStatus(status: PaymentRecord['status'] | string | undefined) {
  const normalised = String(status || 'pending').toLowerCase();
  if (normalised === 'success') return { label: 'Paid', badge: 'bg-emerald-100 text-emerald-700', icon: 'bg-emerald-100', iconColor: 'text-emerald-600', successful: true };
  if (normalised === 'pending') return { label: 'Pending', badge: 'bg-amber-100 text-amber-700', icon: 'bg-amber-100', iconColor: 'text-amber-600', successful: false };
  if (normalised === 'refunded') return { label: 'Refunded', badge: 'bg-blue-100 text-blue-700', icon: 'bg-blue-100', iconColor: 'text-blue-600', successful: false };
  return { label: 'Failed', badge: 'bg-red-100 text-red-600', icon: 'bg-red-100', iconColor: 'text-red-500', successful: false };
}

// ─── Confirm Subscribe Modal ───────────────────────────────────────────────────
function ConfirmModal({
  plan, onConfirm, onCancel, loading, format,
}: {
  plan: BillingPlan; onConfirm: () => void; onCancel: () => void;
  loading: boolean; format: (n: number) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full z-10"
      >
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Upgrade to {plan.name}</h3>
            <p className="text-xs text-gray-400">Demo payment — no real charges</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{plan.name} Plan</span>
            <span className="font-semibold text-gray-800">{format(plan.price)}/mo</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">GST (18%)</span>
            <span className="text-gray-600">{format(plan.price * 0.18)}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">{format(plan.price * 1.18)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl border-gray-200" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            onClick={onConfirm} disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCheck className="w-4 h-4 mr-1" />}
            {loading ? 'Processing…' : 'Confirm'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Payments() {
  const { format } = useCurrency();
  const { toast } = useToast();
  const { user } = useAuth();

  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<BillingPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [walletBalance, setWalletBalance] = useState<number>((user as any)?.walletBalance || 0);
  const [rechargeAmount, setRechargeAmount] = useState<string>('500');
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    loadBilling();
  }, []);

  async function loadBilling() {
    setLoading(true);
    setError(null);
    try {
      const data: any = await api.billing.getOverview();
      const billingObj = data?.billing || data;
      setBilling({
        plans: normalisePlanCatalogue(billingObj?.plans || data?.availablePlans),
        history: billingObj?.history || [],
        currentPlan: billingObj?.currentPlan || null,
        paymentMethod: billingObj?.paymentMethod || null,
      });
    } catch (err: any) {
      setBilling({
        plans: DEFAULT_PLANS,
        history: [],
        currentPlan: null,
        paymentMethod: null,
      });
      if (err instanceof ApiError && err.status !== 401 && err.status !== 503) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function launchRazorpay({
    amount, type, targetId, billingCycle: selectedBillingCycle, description, onSuccess,
  }: {
    amount: number;
    type: string;
    targetId?: string;
    billingCycle?: 'monthly' | 'yearly';
    description: string;
    onSuccess: (paymentId: string) => void;
  }) {
    try {
      await loadRazorpayScript();
    } catch {
      toast({ variant: 'destructive', title: 'Razorpay unavailable', description: 'Could not load payment gateway. Please refresh and try again.' });
      return;
    }

    api.payments.createOrder({ amount, type, targetId, billingCycle: selectedBillingCycle }).then((orderRes) => {
      const { order, razorpayKeyId } = orderRes;
      if (!order || !razorpayKeyId) {
        toast({ variant: 'destructive', title: 'Order creation failed', description: 'Could not initiate payment. Check Razorpay keys in .env' });
        return;
      }

      const options = {
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'MindCare',
        description,
        order_id: order.id,
        theme: { color: '#2a7d46' },
        modal: {
          ondismiss: () => {
            toast({ variant: 'destructive', title: 'Payment Cancelled', description: 'You closed the payment dialog.' });
          },
        },
        handler: async (response: any) => {
          try {
            await api.payments.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type,
              targetId: targetId || '',
              amount,
              billingCycle: selectedBillingCycle,
            });
            onSuccess(response.razorpay_payment_id);
          } catch (verifyErr: any) {
            toast({ variant: 'destructive', title: 'Payment Verification Failed', description: verifyErr.message });
          }
        },
      };

      openRazorpayCheckout(options).catch(() => {});
    }).catch((err: any) => {
      toast({ variant: 'destructive', title: 'Could not create order', description: err.message });
    });
  }

  async function handleSubscribe(plan: BillingPlan) {
    if (plan.price === 0) return;
    setConfirmPlan(plan);
  }

  async function confirmSubscribe() {
    if (!confirmPlan) return;
    setSubscribing(confirmPlan._id);
    const displayAmount = billingCycle === 'yearly' && confirmPlan.price > 0
      ? annualPrice(confirmPlan.price)
      : confirmPlan.price;

    launchRazorpay({
      amount: displayAmount,
      type: 'subscription',
      targetId: confirmPlan._id,
      billingCycle,
      description: `${confirmPlan.name} Plan – ${billingCycle === 'yearly' ? 'Annual' : 'Monthly'}`,
      onSuccess: async (paymentId) => {
        toast({
          title: `🎉 Upgraded to ${confirmPlan!.name}!`,
          description: `Receipt: #${paymentId}. Your subscription is now active.`,
        });
        setConfirmPlan(null);
        setSubscribing(null);
        await loadBilling();
      },
    });
    setSubscribing(null);
  }

  async function handleWalletRecharge() {
    const amt = Number(rechargeAmount);
    if (!amt || amt < 10) {
      toast({ variant: 'destructive', title: 'Minimum recharge is ₹10' });
      return;
    }
    setRecharging(true);
    launchRazorpay({
      amount: amt,
      type: 'wallet_deposit',
      description: `MindCare Wallet Recharge – ₹${amt}`,
      onSuccess: async (paymentId) => {
        setWalletBalance(prev => prev + amt);
        toast({ title: `₹${amt} added to wallet! 🎉`, description: `Receipt: #${paymentId}` });
        setRecharging(false);
        await loadBilling();
      },
    });
    setRecharging(false);
  }

  function downloadReceipt(record: PaymentRecord) {
    const invoiceNum = record.invoiceNumber || `INV-${(record._id || '').slice(-6).toUpperCase()}`;
    const dateStr = new Date(record.createdAt || Date.now()).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    const subtotal = record.amount || 0;
    const gstAmount = Math.round(subtotal * 0.18);
    const grandTotal = subtotal + gstAmount;

    const cleanDescription = (record.description || 'MindCare Subscription').replace(/[()]/g, '');
    const cleanMethod = (record.paymentMethod || 'Razorpay / Cards / UPI').replace(/[()]/g, '');
    const cleanStatus = (record.status || 'success').toUpperCase();

    const pdfLines = [
      '%PDF-1.4',
      '1 0 obj',
      '<< /Type /Catalog /Pages 2 0 R >>',
      'endobj',
      '2 0 obj',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      'endobj',
      '3 0 obj',
      '<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 595 842] /Contents 5 0 R >>',
      'endobj',
      '4 0 obj',
      '<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>',
      'endobj',
      '5 0 obj',
      '<< /Length 3000 >>',
      'stream',
      // Outer border vector outline
      '0.93 0.93 0.93 RG',
      '1.5 w',
      '40 40 515 762 re',
      'S',
      // Header container background
      '0.97 0.99 0.97 rg',
      '60 735 475 50 re',
      'f',
      // Logo box container (Rounded light emerald background: bg-primary/10)
      '0.90 0.96 0.92 rg',
      '70 738 38 38 re',
      'f',
      '0.80 0.90 0.83 RG',
      '1 w',
      '70 738 38 38 re',
      'S',
      // Precise Lucide Brain Icon vector drawing inside box
      '0.16 0.52 0.29 RG',
      '1.6 w',
      // Left Brain Hemisphere
      '89 766 m 83 766 77 761 77 755 c 77 750 81 747 84 747 c 87 747 89 750 89 753 c S',
      '82 763 m 85 759 81 753 78 753 c S',
      // Right Brain Hemisphere
      '91 766 m 97 766 103 761 103 755 c 103 750 99 747 96 747 c 93 747 91 750 91 753 c S',
      '98 763 m 95 759 99 753 102 753 c S',
      // Brain Central Stem & Neural Folds
      '89 766 m 89 746 91 746 91 766 c S',
      '85 755 m 95 755 l S',
      // MindCare Brand Typography (Mind + Care)
      'BT',
      '/F2 20 Tf',
      '0.07 0.09 0.15 rg',
      '118 758 Td',
      '(Mind) Tj',
      'ET',
      'BT',
      '/F2 20 Tf',
      '0.16 0.52 0.29 rg',
      '168 758 Td',
      '(Care) Tj',
      'ET',
      // Subtitle tagline
      'BT',
      '/F1 8.5 Tf',
      '0.55 0.55 0.55 rg',
      '118 745 Td',
      '(AI-Powered Mental Wellness) Tj',
      'ET',
      // Invoice Title Label right aligned
      'BT',
      '/F2 15 Tf',
      '0.16 0.49 0.27 rg',
      '410 755 Td',
      '(OFFICIAL INVOICE) Tj',
      'ET',
      // Header Divider Line
      '0.88 0.88 0.88 RG',
      '1 w',
      '60 720 m 535 720 l S',
      // Invoice Metadata Bar
      'BT',
      '/F2 9.5 Tf',
      '0.2 0.2 0.2 rg',
      '60 695 Td',
      `(Invoice No: ${invoiceNum}) Tj`,
      'ET',
      'BT',
      '/F1 9.5 Tf',
      '0.4 0.4 0.4 rg',
      '240 695 Td',
      `(Date: ${dateStr}) Tj`,
      'ET',
      'BT',
      '/F2 9.5 Tf',
      '0.1 0.6 0.2 rg',
      '430 695 Td',
      `(${cleanStatus} - PAID) Tj`,
      'ET',
      // Section 1: Customer & Business Details Box
      '0.92 0.92 0.92 RG',
      '0.98 0.99 0.98 rg',
      '60 570 475 105 re',
      'B',
      'BT',
      '/F2 10 Tf',
      '0.16 0.49 0.27 rg',
      '75 655 Td',
      '(ISSUED BY:) Tj',
      'ET',
      'BT',
      '/F1 9 Tf',
      '0.3 0.3 0.3 rg',
      '75 640 Td',
      '14 TL',
      '(MindCare Technologies Pvt Ltd) Tj T*',
      '(Kochi, Kerala, India - 682030) Tj T*',
      '(GSTIN: 32AAACM9842K1Z9 · support@mindcare.com) Tj T*',
      'ET',
      'BT',
      '/F2 10 Tf',
      '0.16 0.49 0.27 rg',
      '330 655 Td',
      '(PAYMENT DETAILS:) Tj',
      'ET',
      'BT',
      '/F1 9 Tf',
      '0.3 0.3 0.3 rg',
      '330 640 Td',
      '14 TL',
      '(Payment Gateway: Razorpay 256-bit SSL) Tj T*',
      `(Method: ${cleanMethod}) Tj T*`,
      '(Status: Successful & Verified) Tj T*',
      'ET',
      // Section 2: Order Item Breakdown Table
      '0.16 0.49 0.27 rg',
      '60 520 475 24 re',
      'f',
      'BT',
      '/F2 9.5 Tf',
      '1.0 1.0 1.0 rg',
      '75 528 Td',
      '(DESCRIPTION) Tj',
      'ET',
      'BT',
      '/F2 9.5 Tf',
      '1.0 1.0 1.0 rg',
      '360 528 Td',
      '(QTY) Tj',
      'ET',
      'BT',
      '/F2 9.5 Tf',
      '1.0 1.0 1.0 rg',
      '440 528 Td',
      '(AMOUNT (INR)) Tj',
      'ET',
      // Item row
      'BT',
      '/F1 9.5 Tf',
      '0.2 0.2 0.2 rg',
      '75 495 Td',
      `(${cleanDescription}) Tj`,
      'ET',
      'BT',
      '/F1 9.5 Tf',
      '0.2 0.2 0.2 rg',
      '365 495 Td',
      '(1) Tj',
      'ET',
      'BT',
      '/F1 9.5 Tf',
      '0.2 0.2 0.2 rg',
      '445 495 Td',
      `(Rs. ${subtotal}) Tj`,
      'ET',
      // Row underline
      '0.9 0.9 0.9 RG',
      '60 480 m 535 480 l S',
      // Tax row
      'BT',
      '/F1 9.5 Tf',
      '0.4 0.4 0.4 rg',
      '75 460 Td',
      '(GST (18% Goods & Services Tax)) Tj',
      'ET',
      'BT',
      '/F1 9.5 Tf',
      '0.4 0.4 0.4 rg',
      '365 460 Td',
      '(18%) Tj',
      'ET',
      'BT',
      '/F1 9.5 Tf',
      '0.4 0.4 0.4 rg',
      '445 460 Td',
      `(Rs. ${gstAmount}) Tj`,
      'ET',
      '0.9 0.9 0.9 RG',
      '60 445 m 535 445 l S',
      // Total Box
      '0.93 0.97 0.94 rg',
      '300 395 235 40 re',
      'f',
      'BT',
      '/F2 11 Tf',
      '0.16 0.49 0.27 rg',
      '315 410 Td',
      '(TOTAL AMOUNT PAID:) Tj',
      'ET',
      'BT',
      '/F2 13 Tf',
      '0.16 0.49 0.27 rg',
      '445 409 Td',
      `(Rs. ${grandTotal}) Tj`,
      'ET',
      // Security & Authenticity Stamp Box
      '0.95 0.98 0.96 rg',
      '60 300 475 70 re',
      'f',
      '0.16 0.49 0.27 RG',
      '1 w',
      '60 300 475 70 re',
      'S',
      'BT',
      '/F2 10 Tf',
      '0.16 0.49 0.27 rg',
      '75 350 Td',
      '(DIGITALLY VERIFIED INVOICE) Tj',
      'ET',
      'BT',
      '/F1 8.5 Tf',
      '0.3 0.3 0.3 rg',
      '75 334 Td',
      '13 TL',
      '(This document serves as an official electronic tax receipt for your MindCare subscription.) Tj T*',
      '(Transactions are secured with 256-bit encryption. No physical signature is required.) Tj T*',
      '(For billing support or inquiries, please contact support@mindcare.com) Tj T*',
      'ET',
      // Footer Line
      '0.9 0.9 0.9 RG',
      '60 260 m 535 260 l S',
      'BT',
      '/F1 8 Tf',
      '0.5 0.5 0.5 rg',
      '60 240 Td',
      '(Thank you for choosing MindCare · Healthcare SaaS Subscription System · www.mindcare.com) Tj',
      'ET',
      'endstream',
      'endobj',
      'xref',
      '0 6',
      '0000000000 65535 f ',
      '0000000009 00000 n ',
      '0000000058 00000 n ',
      '0000000115 00000 n ',
      '0000000214 00000 n ',
      '0000000293 00000 n ',
      'trailer',
      '<< /Size 6 /Root 1 0 R >>',
      'startxref',
      '450',
      '%%EOF'
    ];

    const blob = new Blob([pdfLines.join('\n')], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MindCare_Invoice_${invoiceNum}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: '📄 PDF Receipt Downloaded', description: `Invoice MindCare_Invoice_${invoiceNum}.pdf generated successfully.` });
  }

  const plans = normalisePlanCatalogue(billing?.plans);
  const yearlyDiscount = 0.2; // 20% off

  // Determine which plan is "current"
  const currentPlanName = billing?.currentPlan?.name || user?.subscription?.planName || 'Free';

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Plans &amp; Billing</h1>
            <p className="text-sm text-gray-400">Choose the plan that best fits your wellness journey.</p>
          </div>
          <Button
            variant="outline" size="sm"
            className="rounded-xl border-gray-200 text-xs gap-1.5 h-8"
            onClick={loadBilling} disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </motion.div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2"
            >
              <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">{error} — showing default plans.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ethical Healthcare Rule Banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-900"
        >
          <Shield className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-sm text-emerald-950 mb-0.5">Ethical Healthcare Commitment</h4>
            <p className="leading-relaxed text-emerald-800">
              Mental health crisis support is <strong>100% Free for all users</strong>. Features including <em>Suicide Risk Detection, Emergency Crisis Escalation, Continuous Distress Monitoring, AI Safety Monitoring, and Emergency Helpline Guidance</em> are permanently free and never require a paid subscription.
            </p>
          </div>
        </motion.div>

        {/* ── Billing Cycle Toggle ─────────────────────────────────────────── */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Yearly
              <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold">-20%</span>
            </button>
          </div>
        </div>

        {/* ── Plan Cards ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border-2 border-gray-100 p-6 animate-pulse bg-gray-50">
                <div className="h-5 bg-gray-200 rounded w-20 mb-3" />
                <div className="h-10 bg-gray-200 rounded w-28 mb-5" />
                <div className="space-y-2.5">
                  {[1,2,3,4].map(j => <div key={j} className="h-3 bg-gray-200 rounded w-full" />)}
                </div>
                <div className="h-10 bg-gray-200 rounded-xl mt-6" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan, i) => {
              const meta = PLAN_META[plan.name] || PLAN_META['Free'];
              const isCurrent = plan.name === currentPlanName || (plan.price === 0 && !currentPlanName);
              const isSubbing = subscribing === plan._id;
              
              const displayPrice = plan.price === 0 ? 0 : (
                billingCycle === 'yearly'
                  ? annualPrice(plan.price)
                  : plan.price
              );
              const monthlyEquiv = billingCycle === 'yearly' && plan.price > 0
                ? Math.round(annualPrice(plan.price) / 12)
                : null;

              return (
                <motion.div
                  key={plan._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative rounded-2xl border-2 p-6 flex flex-col transition-shadow hover:shadow-lg ${
                    plan.popular ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/60 to-white shadow-md' :
                    plan.name === 'Professional' ? 'border-violet-300 bg-gradient-to-b from-violet-50/50 to-white' :
                    'border-gray-200 bg-white'
                  } ${isCurrent ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
                >
                  {/* Popular badge - HIGHLIGHT ONLY PREMIUM */}
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Badge className="bg-emerald-600 text-white border-0 font-bold px-3.5 py-1 shadow-lg text-xs rounded-full">
                        ⚡ Most Popular
                      </Badge>
                    </div>
                  )}

                  {/* Current plan badge */}
                  {isCurrent && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs font-semibold">
                        <CheckCheck className="w-3 h-3 mr-1" />Current
                      </Badge>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="mb-5">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold mb-2 ${meta.textAccent} bg-white border ${meta.accent} shadow-sm`}>
                      {meta.icon}
                      {plan.name}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-gray-400 font-medium mb-2">{plan.description}</p>
                    )}
                    <div className="flex items-baseline gap-1">
                      {plan.price === 0 ? (
                        <span className="text-4xl font-black text-gray-900">₹0</span>
                      ) : (
                        <>
                          <span className="text-4xl font-black text-gray-900">{format(displayPrice)}</span>
                          <span className="text-sm font-medium text-gray-500">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                        </>
                      )}
                    </div>
                    {monthlyEquiv && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(monthlyEquiv)}/mo · <span className="text-emerald-600 font-semibold">Save 20%</span>
                      </p>
                    )}
                    {plan.price === 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">No credit card required</p>
                    )}
                  </div>

                  {/* Included vs Not Included Features */}
                  <div className="space-y-3 mb-6 flex-1">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">Included</p>
                      <ul className="space-y-2">
                        {plan.features.map(f => (
                          <li key={f} className="flex items-start gap-2 text-xs text-gray-700 leading-tight">
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              plan.name === 'Professional' ? 'text-violet-500' :
                              plan.popular ? 'text-emerald-500' : 'text-blue-500'
                            }`} />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {plan.notIncluded && plan.notIncluded.length > 0 && (
                      <div className="pt-2.5 border-t border-gray-100">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500 mb-1.5">Not Included</p>
                        <ul className="space-y-1.5">
                          {plan.notIncluded.map(nf => (
                            <li key={nf} className="flex items-start gap-2 text-xs text-gray-400 line-through leading-tight">
                              <XCircle className="w-3.5 h-3.5 text-rose-400 opacity-70 shrink-0 mt-0.5" />
                              <span>{nf}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Button
                    id={`subscribe-${plan.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    className={`w-full rounded-xl h-11 font-semibold text-sm transition-all ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-500 cursor-default hover:bg-gray-100'
                        : plan.popular
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                        : plan.name === 'Professional'
                        ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    onClick={() => !isCurrent && plan.price > 0 && handleSubscribe(plan)}
                    disabled={isCurrent || plan.price === 0 || isSubbing}
                  >
                    {isSubbing ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Processing…</>
                    ) : isCurrent ? (
                      <><CheckCheck className="w-4 h-4 mr-1.5" />Current Plan</>
                    ) : plan.price === 0 ? (
                      plan.buttonText || 'Get Started'
                    ) : (
                      <>{plan.buttonText || 'Upgrade Now'} <ArrowRight className="w-4 h-4 ml-1.5" /></>
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Security note ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Shield className="w-3.5 h-3.5" />
          <span>Payments are secured by Razorpay · 256-bit SSL · Instant receipt via email</span>
        </div>

        {/* ── Wallet Balance ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" /> MindCare Wallet
            </h3>
            <span className="text-2xl font-black text-emerald-700">₹{walletBalance.toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">Your wallet balance is used for session payments and bookings.</p>
          <div className="flex gap-2">
            <Input
              id="wallet-recharge-amount"
              type="number"
              min={10}
              placeholder="Amount (₹)"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              className="h-9 rounded-xl border-gray-200 text-sm max-w-[140px]"
            />
            <Button
              id="wallet-recharge-btn"
              onClick={handleWalletRecharge}
              disabled={recharging}
              className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
            >
              {recharging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Recharge
            </Button>
          </div>
        </motion.div>

        {/* ── Payment Method ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-400" /> Payment Method
            </h3>
            <Button
              id="add-payment-method"
              size="sm" variant="outline"
              className="rounded-xl border-gray-200 text-xs gap-1.5 h-8"
              onClick={() => toast({ title: 'Razorpay integration required', description: 'Connect your Razorpay account to enable live payments.' })}
            >
              <CreditCard className="w-3.5 h-3.5" /> Add Card
            </Button>
          </div>

          {billing?.paymentMethod ? (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-12 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs font-bold shadow">
                {billing.paymentMethod.brand.slice(0, 4).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-700 text-sm">{billing.paymentMethod.label}</p>
                <p className="text-xs text-gray-400">{billing.paymentMethod.expires}</p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Default</Badge>
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl border-2 border-dashed border-gray-200">
              <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No payment method on file</p>
              <p className="text-xs text-gray-400 mt-1">Add a card to upgrade your plan</p>
            </div>
          )}
        </motion.div>

        {/* ── Billing History ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-gray-400" /> Billing History
            </h3>
            {billing?.history?.length ? (
              <span className="text-xs text-gray-400">{billing.history.length} transaction{billing.history.length > 1 ? 's' : ''}</span>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-gray-50">
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-gray-200 rounded w-44" />
                    <div className="h-2.5 bg-gray-100 rounded w-24" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-4 bg-gray-200 rounded w-14" />
                    <div className="h-5 bg-gray-100 rounded w-10" />
                    <div className="h-7 bg-gray-100 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : billing?.history?.length ? (
            <div className="divide-y divide-gray-50">
              {billing.history.map((record, i) => {
                const status = getPaymentStatus(record.status);
                return <motion.div
                  key={record._id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${status.icon}`}>
                      {status.successful
                        ? <CheckCircle2 className={`w-4 h-4 ${status.iconColor}`} />
                        : <AlertCircle className={`w-4 h-4 ${status.iconColor}`} />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 text-sm leading-tight">{record.description}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(record.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {record.invoiceNumber && <span className="ml-1 text-gray-300">· #{record.invoiceNumber}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-gray-800 text-sm">{format(record.amount)}</span>
                    <Badge className={`text-xs border-0 ${status.badge}`}>
                      {status.label}
                    </Badge>
                    <Button
                      id={`download-receipt-${i}`}
                      size="sm" variant="ghost"
                      className="text-xs text-primary h-7 px-2 hover:bg-primary/5 rounded-lg gap-1"
                      onClick={() => downloadReceipt(record)}
                    >
                      <Download className="w-3 h-3" /> Receipt
                    </Button>
                  </div>
                </motion.div>;
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No transactions yet</p>
              <p className="text-xs text-gray-400 mt-1">Your billing history will appear here after your first payment.</p>
            </div>
          )}
        </motion.div>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 p-5"
        >
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-gray-400" /> Frequently Asked
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { q: 'Can I cancel anytime?', a: 'Yes. Cancel anytime from the settings. You keep access until the period ends.' },
              { q: 'Is there a free trial?', a: 'The Free plan is forever free. Paid plans use demo payments in this version.' },
              { q: 'How are payments processed?', a: 'Payments are processed via Razorpay with 256-bit SSL encryption.' },
              { q: 'Can I switch plans?', a: 'Yes. Upgrade or downgrade anytime. Credits are prorated automatically.' },
            ].map(({ q, a }) => (
              <div key={q} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <p className="font-semibold text-gray-800 text-sm mb-1">{q}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Confirm Subscribe Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {confirmPlan && (
          <ConfirmModal
            plan={confirmPlan}
            onConfirm={confirmSubscribe}
            onCancel={() => setConfirmPlan(null)}
            loading={!!subscribing}
            format={format}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
