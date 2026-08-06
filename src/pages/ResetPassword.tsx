import { Link, useLocation } from "wouter";
import { Heart, Lock, ArrowRight } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/layout/PageTransition";
import { toast } from "@/hooks/use-toast";
import { sanitizeText } from "@/lib/forms";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .transform(sanitizeText)
      .pipe(z.string().min(8, "Password must be at least 8 characters")),
    confirmPassword: z.string().transform(sanitizeText),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.input<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [, navigate] = useLocation();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(() => {
    toast({
      title: "Password updated",
      description: "Your password has been reset successfully.",
    });
    navigate("/login");
  });

  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col justify-center bg-background py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mb-6 flex justify-center">
            <Heart className="h-10 w-10 fill-primary text-primary" />
          </div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-foreground">Set new password</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Use at least 8 characters to keep your account secure.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-3xl border border-border bg-card px-4 py-8 shadow-sm sm:px-10">
            <Form {...form}>
              <form className="space-y-6" onSubmit={onSubmit} noValidate>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input {...field} className="h-12 rounded-xl pl-10" placeholder="••••••••" type="password" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input {...field} className="h-12 rounded-xl pl-10" placeholder="••••••••" type="password" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button className="h-12 w-full rounded-xl text-lg" disabled={form.formState.isSubmitting} type="submit">
                  Reset password
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
