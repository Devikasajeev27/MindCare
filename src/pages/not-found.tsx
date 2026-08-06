import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardContent className="pt-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            The page you’re looking for doesn’t exist or may have been moved.
          </p>
          <Button asChild className="mt-6 w-full rounded-xl">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
