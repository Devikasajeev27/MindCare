import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PageTransition } from "@/components/layout/PageTransition";
import { toast } from "@/hooks/use-toast";

const OTP_LENGTH = 6;

export default function OTPVerify() {
  const [value, setValue] = useState("");
  const [, navigate] = useLocation();

  const handleVerify = () => {
    if (value.length !== OTP_LENGTH) {
      toast({
        title: "Incomplete code",
        description: "Enter the full 6-digit verification code to continue.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Code verified",
      description: "You can now create a new password.",
    });
    navigate("/reset-password");
  };

  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col justify-center bg-background py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mb-6 flex justify-center">
            <Heart className="h-10 w-10 fill-primary text-primary" />
          </div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-foreground">Check your email</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We sent a 6-digit verification code to your email address.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-3xl border border-border bg-card px-4 py-8 shadow-sm sm:px-10">
            <div className="flex flex-col items-center justify-center space-y-6">
              <InputOTP maxLength={OTP_LENGTH} value={value} onChange={setValue}>
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className={`h-14 w-12 text-xl ${index === 0 ? "rounded-l-xl" : ""} ${index === OTP_LENGTH - 1 ? "rounded-r-xl" : ""}`}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <Button className="h-12 w-full rounded-xl text-lg" onClick={handleVerify} type="button">
                Verify code
              </Button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Didn’t receive the code?{" "}
                <button
                  className="font-medium text-primary hover:text-primary/80"
                  onClick={() =>
                    toast({
                      title: "Code resent",
                      description: "A new verification code is on its way.",
                    })
                  }
                  type="button"
                >
                  Resend
                </button>
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80">
                Use a different email
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
