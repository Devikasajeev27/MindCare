import React from 'react';
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Brain, Users, ShieldCheck, Shield, ArrowRight, HeartPulse,
  Activity, ShieldAlert, Star, CheckCircle2, Phone,
  Apple, PlayCircle, ChevronRight, Heart, MessageSquare
} from 'lucide-react';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.1, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col font-sans">
      <Navbar />

      {/* ── HERO ── */}
      <section id="hero" className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-0 lg:pb-0">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left */}
            <motion.div
              className="pb-12 lg:pb-16 max-w-xl"
              initial="hidden" animate="visible" variants={fadeUp}
            >
              <motion.h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6"
                variants={fadeUp} custom={0}
              >
                AI-Powered Support.<br />
                <span className="text-primary">Human Care.</span><br />
                Better You.
              </motion.h1>
              <motion.p
                className="text-lg text-gray-500 mb-8 leading-relaxed"
                variants={fadeUp} custom={1}
              >
                MindCare combines the power of artificial intelligence, companion support, and professional therapy to help you feel better, every day.
              </motion.p>

              <motion.div className="flex flex-wrap gap-3 mb-8" variants={fadeUp} custom={2}>
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white font-semibold px-7 py-3 rounded-full shadow-lg shadow-primary/25 text-base">
                  <Link href="/register">
                    Get Started for Free <ArrowRight className="ml-1.5 w-4 h-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-gray-200 text-gray-700 font-semibold px-7 py-3 rounded-full text-base hover:border-primary hover:text-primary">
                  <Link href="/ai-assistant">
                    <MessageSquare className="mr-1.5 w-4 h-4" /> Talk to AI Assistant
                  </Link>
                </Button>
              </motion.div>

              <motion.p className="text-sm text-gray-400 flex items-center gap-1.5" variants={fadeUp} custom={3}>
                <Shield className="w-4 h-4 text-primary" />
                Private. Secure. Always here for you.
              </motion.p>
            </motion.div>

            {/* Right – hero image + floating cards */}
            <motion.div
              className="relative hidden lg:block"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className="relative h-[520px] w-full">
                <img
                  src="https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&q=80&w=700"
                  alt="Woman relaxing outdoors"
                  className="absolute inset-0 w-full h-full object-cover object-top rounded-3xl"
                />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/10 to-transparent" />

                {/* Floating feature badges */}
                <div className="absolute top-8 right-4 bg-white rounded-2xl shadow-xl p-3.5 flex items-center gap-3 w-44">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Brain className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">AI Support</p>
                    <p className="text-[10px] text-gray-400">24/7</p>
                  </div>
                </div>
                <div className="absolute top-36 right-4 bg-white rounded-2xl shadow-xl p-3.5 flex items-center gap-3 w-44">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Companion</p>
                    <p className="text-[10px] text-gray-400">Support</p>
                  </div>
                </div>
                <div className="absolute bottom-40 right-4 bg-white rounded-2xl shadow-xl p-3.5 flex items-center gap-3 w-44">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Expert</p>
                    <p className="text-[10px] text-gray-400">Therapists</p>
                  </div>
                </div>
                <div className="absolute bottom-14 right-4 bg-white rounded-2xl shadow-xl p-3.5 flex items-center gap-3 w-44">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Crisis</p>
                    <p className="text-[10px] text-gray-400">Protection</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TRUSTED BY ── */}
      <section className="py-8 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-medium text-gray-400 uppercase tracking-widest mb-6">
            Trusted by thousands of users and mental health professionals
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            {["Forbes", "Healthline", "verywell mind", "Psychology Today", "BUSINESS INSIDER"].map((brand) => (
              <span key={brand} className="text-gray-500 font-bold text-sm sm:text-base tracking-tight">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 bg-[#F8FAF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Comprehensive Wellness Support</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-3">
              Everything You Need for<br className="hidden sm:block" /> Mental Well-being
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                img: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=400",
                title: "AI Emotional Support",
                desc: "Chat with our AI assistant anytime in multiple languages. Get instant emotional guidance and support.",
                color: "bg-blue-500"
              },
              {
                img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=400",
                title: "Companion Support",
                desc: "Connect anonymously with compassionate peers who understand. Voice calls available with favorites.",
                color: "bg-purple-500"
              },
              {
                img: "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&q=80&w=400",
                title: "Therapist Consultation",
                desc: "Book sessions with licensed therapists via chat or voice calls. Professional help when you need it.",
                color: "bg-green-500"
              },
              {
                img: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=400",
                title: "Crisis Intervention",
                desc: "AI detects risks and provides immediate help. Emergency alerts sent to your trusted contacts.",
                color: "bg-red-500"
              },
              {
                img: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?auto=format&fit=crop&q=80&w=400",
                title: "Track & Improve",
                desc: "Monitor mood, track progress, and build healthy habits for a stronger mindset.",
                color: "bg-orange-500"
              }
            ].map((f, i) => (
              <motion.div
                key={i}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 border border-gray-100"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="h-36 overflow-hidden">
                  <img src={f.img} alt={f.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 text-sm mb-1.5">{f.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section id="stats" className="py-10 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { stat: "50K+", label: "Active Users", icon: Users },
              { stat: "1M+", label: "Conversations", icon: MessageSquare },
              { stat: "4.8/5", label: "User Rating", icon: Star },
              { stat: "99%", label: "Privacy Protected", icon: Shield },
            ].map(({ stat, label, icon: Icon }, i) => (
              <motion.div
                key={i}
                className="text-white"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Icon className="w-6 h-6 mx-auto mb-2 text-white/70" />
                <div className="text-3xl sm:text-4xl font-bold mb-1">{stat}</div>
                <div className="text-sm text-white/70 font-medium">{label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 bg-[#F8FAF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary mb-2">How MindCare Works</p>
          <div className="flex flex-col sm:flex-row justify-center items-start gap-0 mt-10">
            {[
              { num: 1, icon: Users, title: "Create Account", desc: "Sign up and add an emergency contact for your safety." },
              { num: 2, icon: MessageSquare, title: "Talk & Share", desc: "Chat with AI or connect with companions to share your feelings." },
              { num: 3, icon: HeartPulse, title: "Connect", desc: "Build meaningful connections and add favorites." },
              { num: 4, icon: ShieldCheck, title: "Get Professional Help", desc: "Consult verified therapists anytime you need." },
              { num: 5, icon: Heart, title: "Feel Better", desc: "Track your progress and live a healthier, happier life." },
            ].map((step, i) => (
              <div key={i} className="flex flex-1 flex-col sm:flex-row items-center">
                <div className="flex flex-col items-center text-center px-4 max-w-[160px]">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 relative">
                    <step.icon className="w-5 h-5 text-primary" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                      {step.num}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm mb-1">{step.title}</h4>
                  <p className="text-gray-500 text-xs leading-relaxed">{step.desc}</p>
                </div>
                {i < 4 && (
                  <div className="hidden sm:block flex-1 h-px bg-gray-200 mt-[-24px]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="about" className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=1600"
            alt="Nature"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/55" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 sm:p-12 text-white text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Start Your Wellness Journey Today</h2>
            <p className="text-white/80 mb-8 text-base">
              Join MindCare and take the first step towards a better, healthier you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-4">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-xl bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button asChild className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-3 rounded-xl w-full sm:w-auto whitespace-nowrap">
                <Link href="/register">Get Started for Free</Link>
              </Button>
            </div>
            <p className="text-xs text-white/50">No credit card required.</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="footer" className="bg-gray-900 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <span className="font-bold text-white text-base block leading-none">MindCare</span>
                  <span className="text-[10px] text-gray-400">AI-Powered Mental Wellness</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">Empowering minds. Enriching lives.</p>
              <div className="flex gap-3">
                {['f', 'in', 't', 'li'].map((s) => (
                  <div key={s} className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300 font-bold hover:bg-primary cursor-pointer transition-colors">{s}</div>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              { title: "Quick Links", links: ["Home", "Features", "Safety & Crisis", "Privacy Policy", "Terms of Service", "Contact Us", "FAQ"] },
              { title: "Support", links: ["Help Center", "Safety & Crisis", "Privacy Policy", "Terms of Service", "Contact Us", "FAQ"] },
              { title: "Resources", links: ["Mental Health Blog", "Self-care Tips", "Community Guidelines", "Workshops & Events"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-bold text-white mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-xs text-gray-400 hover:text-primary transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* App Download */}
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Get the App</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-xl px-3 py-2.5 cursor-pointer transition-colors border border-gray-700">
                  <Apple className="w-5 h-5 text-white" />
                  <div>
                    <p className="text-[9px] text-gray-400">Download on the</p>
                    <p className="text-xs font-semibold text-white">App Store</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-xl px-3 py-2.5 cursor-pointer transition-colors border border-gray-700">
                  <PlayCircle className="w-5 h-5 text-white" />
                  <div>
                    <p className="text-[9px] text-gray-400">Get it on</p>
                    <p className="text-xs font-semibold text-white">Google Play</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="text-xs text-gray-500">&copy; 2025 MindCare. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
