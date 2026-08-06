import { Link, useLocation } from "wouter";
import { Heart, Mail, ArrowRight } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { normalizeEmail } from "@/lib/forms";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address").transform(normalizeEmail),
});

type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [, navigate] = useLocation();

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    toast({
      title: "Reset link sent",
      description: `We sent a 6-digit code to ${normalizeEmail(values.email)}.`,
    });
    navigate("/otp-verify");
  });

  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col justify-center bg-background py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mb-6 flex justify-center">
            <Heart className="h-10 w-10 fill-primary text-primary" />
          </div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-foreground">
            Reset your password
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Enter your email address and we’ll send you a verification code.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-3xl border border-border bg-card px-4 py-8 shadow-sm sm:px-10">
            <Form {...form}>
              <form className="space-y-6" onSubmit={onSubmit} noValidate>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            {...field}
                            autoComplete="email"
                            className="h-12 rounded-xl pl-10"
                            inputMode="email"
                            placeholder="you@example.com"
                            type="email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button className="h-12 w-full rounded-xl text-base" disabled={form.formState.isSubmitting} type="submit">
                  Send verification code
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm font-medium text-primary hover:text-primary/80">
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
