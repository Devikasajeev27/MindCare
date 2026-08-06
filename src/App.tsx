import { Suspense, lazy, useMemo } from "react";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AnimatePresence } from "framer-motion";

import { PageTransition } from "@/components/layout/PageTransition";
import { AppErrorBoundary } from "@/components/feedback/AppErrorBoundary";
import { RouteFallback } from "@/components/feedback/RouteFallback";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import { AuthProvider } from "@/context/AuthContext";
import { CountryProvider } from "@/context/CountryContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { CommunicationProvider } from "@/services/communication/CommunicationProvider";
import { NotificationsProvider } from "@/context/NotificationsContext";

const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const RegisterTherapist = lazy(() => import("@/pages/RegisterTherapist"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const OTPVerify = lazy(() => import("@/pages/OTPVerify"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AiAssistant = lazy(() => import("@/pages/AiAssistant"));
const Companions = lazy(() => import("@/pages/Companions"));
const CompanionChat = lazy(() => import("@/pages/CompanionChat"));
const HelpSomeone = lazy(() => import("@/pages/HelpSomeone"));
const CompanionHelping = lazy(() => import("@/pages/CompanionHelping"));
const Therapists = lazy(() => import("@/pages/Therapists"));
const TherapistChat = lazy(() => import("@/pages/TherapistChat"));
const MoodTracker = lazy(() => import("@/pages/MoodTracker"));
const CrisisSupport = lazy(() => import("@/pages/CrisisSupport"));
const Progress = lazy(() => import("@/pages/Progress"));
const Resources = lazy(() => import("@/pages/Resources"));
const Settings = lazy(() => import("@/pages/Settings"));
const Payments = lazy(() => import("@/pages/Payments"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Journal = lazy(() => import("@/pages/Journal"));
const TherapistDashboard = lazy(() => import("@/pages/TherapistDashboard"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AppointmentDetails = lazy(() => import("./pages/AppointmentDetails")); // Clinical details component
const MyAppointments = lazy(() => import("@/pages/MyAppointments"));
const NotFound = lazy(() => import("@/pages/not-found"));

import { useAuth } from "@/context/AuthContext";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  roles?: string[];
}

function ProtectedRoute({ component: Component, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <RouteFallback />;
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    if (user.role === "therapist") return <Redirect to="/therapist/dashboard" replace />;
    if (user.role === "admin") return <Redirect to="/admin/dashboard" replace />;
    return <Redirect to="/dashboard" replace />;
  }

  return <Component />;
}

interface GuestRouteProps {
  component: React.ComponentType<any>;
}

function GuestRoute({ component: Component }: GuestRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <RouteFallback />;
  }

  if (isAuthenticated && user) {
    if (user.role === "therapist") return <Redirect to="/therapist/dashboard" replace />;
    if (user.role === "admin") return <Redirect to="/admin/dashboard" replace />;
    return <Redirect to="/dashboard" replace />;
  }

  return <Component />;
}

function AnimatedRouter() {
  const [location] = useLocation();

  const routes = useMemo(
    () => (
      <Switch location={location}>
        <Route path="/">
          <GuestRoute component={Landing} />
        </Route>
        <Route path="/login">
          <GuestRoute component={Login} />
        </Route>
        <Route path="/register">
          <GuestRoute component={Register} />
        </Route>
        <Route path="/register-therapist">
          <GuestRoute component={RegisterTherapist} />
        </Route>
        <Route path="/forgot-password">
          <GuestRoute component={ForgotPassword} />
        </Route>
        <Route path="/otp-verify">
          <GuestRoute component={OTPVerify} />
        </Route>
        <Route path="/reset-password">
          <GuestRoute component={ResetPassword} />
        </Route>

        {/* Kept for bookmarks and stale browser tabs from the retired onboarding flow. */}
        <Route path="/onboarding">
          <Redirect to="/dashboard" replace />
        </Route>
        <Route path="/dashboard">
          <ProtectedRoute component={Dashboard} roles={["user"]} />
        </Route>
        <Route path="/ai-assistant">
          <ProtectedRoute component={AiAssistant} roles={["user"]} />
        </Route>
        <Route path="/companions">
          <ProtectedRoute component={Companions} roles={["user"]} />
        </Route>
        <Route path="/companions/help">
          <ProtectedRoute component={HelpSomeone} roles={["user"]} />
        </Route>
        <Route path="/companions/helping">
          <ProtectedRoute component={CompanionHelping} roles={["user"]} />
        </Route>
        <Route path="/companions/chat/:id">
          <ProtectedRoute component={CompanionChat} roles={["user"]} />
        </Route>
        <Route path="/therapists">
          <ProtectedRoute component={Therapists} roles={["user"]} />
        </Route>
        <Route path="/therapist-chat">
          <ProtectedRoute component={TherapistChat} roles={["user"]} />
        </Route>
        <Route path="/therapist/chat">
          <ProtectedRoute component={TherapistChat} roles={["user"]} />
        </Route>
        <Route path="/mood-tracker">
          <ProtectedRoute component={MoodTracker} roles={["user"]} />
        </Route>
        <Route path="/crisis-support">
          <ProtectedRoute component={CrisisSupport} roles={["user"]} />
        </Route>
        <Route path="/progress">
          <ProtectedRoute component={Progress} roles={["user"]} />
        </Route>
        <Route path="/resources">
          <ProtectedRoute component={Resources} roles={["user"]} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={Settings} roles={["user", "therapist", "admin"]} />
        </Route>
        <Route path="/appointments/:appointmentId">
          <ProtectedRoute component={AppointmentDetails} roles={["user", "therapist", "admin"]} />
        </Route>
        <Route path="/appointments">
          <ProtectedRoute component={MyAppointments} roles={["user", "admin"]} />
        </Route>
        <Route path="/payments">
          <ProtectedRoute component={Payments} roles={["user"]} />
        </Route>
        <Route path="/notifications">
          <ProtectedRoute component={Notifications} roles={["user"]} />
        </Route>
        <Route path="/journal">
          <ProtectedRoute component={Journal} roles={["user"]} />
        </Route>
        <Route path="/therapist/dashboard">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/therapist/appointments">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/therapist/patients">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/therapist/messages">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/therapist/analytics">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/therapist/availability">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/therapist/earnings">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/therapist/resources">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/therapist/settings">
          <ProtectedRoute component={TherapistDashboard} roles={["therapist"]} />
        </Route>
        <Route path="/admin/dashboard">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/users">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/therapists">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/companions">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/alerts">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/audit-logs">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/settings">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/revenue">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route path="/admin/appointments">
          <ProtectedRoute component={AdminDashboard} roles={["admin"]} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    ),
    [location],
  );

  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={location}>
        <Suspense fallback={<RouteFallback />}>{routes}</Suspense>
      </PageTransition>
    </AnimatePresence>
  );
}

function App() {
  const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

  return (
    <AppErrorBoundary>
      <TooltipProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <CommunicationProvider>
                <NotificationsProvider>
                  <CountryProvider>
                    <CurrencyProvider>
                      <WouterRouter base={routerBase}>
                        <ScrollToTop />
                        <AnimatedRouter />
                      </WouterRouter>
                    </CurrencyProvider>
                  </CountryProvider>
                </NotificationsProvider>
              </CommunicationProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Toaster />
      </TooltipProvider>
    </AppErrorBoundary>
  );
}

export default App;
