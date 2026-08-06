import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowLeft, ArrowRight, Brain, Check, Heart, MessageSquare, Star, Users, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

type AnswerValue = string | number;
type Answers = Partial<Record<"goal" | "experience" | "frequency", AnswerValue>>;

type ChoiceOption = {
  label: string;
  value: AnswerValue;
  icon?: LucideIcon;
  emoji?: string;
};

type OnboardingStep =
  | {
      id: "welcome" | "done";
      title: string;
      subtitle: string;
      type: "welcome" | "done";
    }
  | {
      id: "goal" | "frequency";
      title: string;
      subtitle: string;
      type: "choice";
      options: ChoiceOption[];
    }
  | {
      id: "experience";
      title: string;
      subtitle: string;
      type: "mood";
      options: ChoiceOption[];
    };

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to MindCare 🌱",
    subtitle: "Your personal AI-powered mental wellness companion. Let’s set you up for success.",
    type: "welcome",
  },
  {
    id: "goal",
    title: "What brings you here?",
    subtitle: "Choose your primary goal. You can always change this later.",
    type: "choice",
    options: [
      { icon: Heart, label: "Manage anxiety or stress", value: "anxiety" },
      { icon: Activity, label: "Track and improve my mood", value: "mood" },
      { icon: MessageSquare, label: "Get emotional support", value: "support" },
      { icon: Users, label: "Connect with a therapist", value: "therapy" },
      { icon: Star, label: "Build healthy habits", value: "habits" },
    ],
  },
  {
    id: "experience",
    title: "How are you feeling today?",
    subtitle: "Be honest — there’s no wrong answer here.",
    type: "mood",
    options: [
      { emoji: "😰", label: "Very anxious", value: 1 },
      { emoji: "😔", label: "Down or sad", value: 2 },
      { emoji: "😐", label: "Just okay", value: 3 },
      { emoji: "🙂", label: "Pretty good", value: 4 },
      { emoji: "😄", label: "Feeling great!", value: 5 },
    ],
  },
  {
    id: "frequency",
    title: "How often do you want to check in?",
    subtitle: "Consistent check-ins help you track progress more accurately.",
    type: "choice",
    options: [
      { label: "Multiple times a day", value: "multiple", emoji: "🔥" },
      { label: "Once a day", value: "daily", emoji: "☀️" },
      { label: "A few times a week", value: "weekly", emoji: "📅" },
      { label: "Whenever I need it", value: "asneeded", emoji: "🌙" },
    ],
  },
  {
    id: "done",
    title: "You’re all set! 🎉",
    subtitle: "Your personalized wellness journey begins now. Remember — every small step counts.",
    type: "done",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [, navigate] = useLocation();
  const { completeOnboarding } = useAuth();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const canProceed = useMemo(() => {
    if (current.type === "welcome" || current.type === "done") {
      return true;
    }

    if (current.type === "choice" || current.type === "mood") {
      return answers[current.id] !== undefined;
    }

    return false;
  }, [answers, current]);

  const select = (key: keyof Answers, value: AnswerValue) => {
    setAnswers((previousAnswers) => ({ ...previousAnswers, [key]: value }));
  };

  const next = async () => {
    if (isLast) {
      try {
        const wellnessScore = answers.experience ? Number(answers.experience) * 20 : 60;
        await completeOnboarding(answers, wellnessScore);
      } catch (err) {
        console.error("Failed to complete onboarding API request:", err);
      }
      navigate("/dashboard");
      return;
    }

    setStep((currentStep) => currentStep + 1);
  };

  const back = () => setStep((currentStep) => currentStep - 1);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0faf5] via-white to-[#e8f5e9] p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-bold text-gray-900">MindCare</span>
        </div>

        <div className="mb-8 flex gap-1.5 px-4" aria-label="Onboarding progress">
          {STEPS.map((onboardingStep, index) => (
            <div
              key={onboardingStep.id}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${index <= step ? "bg-primary" : "bg-gray-200"}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="rounded-3xl bg-white p-8 shadow-xl"
          >
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-2xl font-bold text-gray-900">{current.title}</h1>
              <p className="text-sm leading-relaxed text-gray-500">{current.subtitle}</p>
            </div>

            {current.type === "welcome" && (
              <div className="mb-6 flex justify-center">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-6xl">🌱</span>
                </div>
              </div>
            )}

            {current.type === "done" && (
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-green-100">
                    <span className="text-5xl">🎉</span>
                  </div>
                  <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-md">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            )}

            {current.type === "choice" && (
              <div className="mb-6 space-y-3">
                {current.options.map((option) => {
                  const isSelected = answers[current.id] === option.value;
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => select(current.id, option.value)}
                      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${isSelected ? "border-primary bg-primary/5" : "border-gray-100 bg-gray-50 hover:border-gray-200"}`}
                    >
                      {option.icon ? (
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-primary text-white" : "bg-gray-200 text-gray-500"}`}
                        >
                          <option.icon className="h-5 w-5" />
                        </div>
                      ) : null}
                      {option.emoji ? <span className="shrink-0 text-2xl">{option.emoji}</span> : null}
                      <span className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-gray-700"}`}>
                        {option.label}
                      </span>
                      {isSelected ? <Check className="ml-auto h-5 w-5 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            )}

            {current.type === "mood" && (
              <div className="mb-6 flex flex-wrap justify-center gap-3">
                {current.options.map((option) => {
                  const isSelected = answers[current.id] === option.value;
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => select(current.id, option.value)}
                      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all ${isSelected ? "scale-110 border-primary bg-primary/5" : "border-gray-100 bg-gray-50 hover:border-gray-200"}`}
                    >
                      <span className="text-3xl">{option.emoji}</span>
                      <span className="max-w-[64px] text-center text-xs font-semibold leading-tight text-gray-600">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {current.type === "done" && (
              <div className="mb-6 space-y-2 rounded-2xl bg-gray-50 p-4">
                {[
                  { label: "Primary Goal", value: answers.goal ?? "Not set" },
                  { label: "Check-in Frequency", value: answers.frequency ?? "As needed" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-500">{item.label}</span>
                    <span className="font-bold capitalize text-gray-800">
                      {String(item.value).replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              {!isFirst ? (
                <Button variant="outline" onClick={back} className="h-12 rounded-xl border-gray-200 px-5 gap-2" type="button">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : null}
              <Button
                onClick={next}
                disabled={!canProceed}
                className="h-12 flex-1 gap-2 rounded-xl bg-primary font-semibold text-white disabled:opacity-40"
                type="button"
              >
                {isLast ? "Start My Journey" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="mt-6 text-center text-xs text-gray-400">🔒 Your data is private, encrypted, and never sold.</p>
      </div>
    </div>
  );
}
