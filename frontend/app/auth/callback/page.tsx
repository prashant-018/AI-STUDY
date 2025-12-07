"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth() as any;

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const details = searchParams.get("details");
    const token = searchParams.get("token");

    const handleCallback = async () => {
      // Handle OAuth errors
      if (error) {
        console.error("❌ OAuth error:", error);
        if (details) console.error("   Details:", details);

        // Redirect to login with error
        const errorParams = new URLSearchParams({ error });
        if (details) errorParams.set("details", details);
        router.push(`/?${errorParams.toString()}`);
        return;
      }

      // Handle successful OAuth
      if (success === "true" && token) {
        try {
          console.log("✅ OAuth callback successful");

          // Save token to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', token);
            // Remove token from URL for security
            const url = new URL(window.location.href);
            url.searchParams.delete('token');
            url.searchParams.delete('success');
            window.history.replaceState({}, '', url.toString());
          }

          // Wait briefly for token to be saved
          await new Promise(resolve => setTimeout(resolve, 300));

          // Fetch user data using the token
          if (auth?.getUser) {
            const user = await auth.getUser();
            if (user) {
              console.log("✅ User authenticated successfully:", user.email);
              // Redirect to dashboard
              router.push("/");
              return;
            }
          }

          // If getUser failed, try direct API call
          try {
            const response = await fetch('/api/auth/me', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });

            if (response.ok) {
              const data = await response.json();
              if (data?.success && data?.user) {
                console.log("✅ Authentication successful using direct API call");
                // Refresh auth context
                if (auth?.getUser) {
                  await auth.getUser();
                }
                router.push("/");
                return;
              }
            }
          } catch (apiErr) {
            console.error("❌ Direct API call failed:", apiErr);
          }

          router.push("/?error=auth_failed&details=Failed to authenticate user. Please try logging in again.");
        } catch (err: any) {
          console.error("❌ Authentication error:", err);
          router.push(`/?error=auth_failed&details=${encodeURIComponent(err?.message || "Authentication failed")}`);
        }
      } else {
        // Missing token or success flag
        console.warn("⚠️ Invalid callback state - missing token or success flag");
        router.push("/?error=auth_failed&details=Invalid authentication response. Please try again.");
      }
    };

    handleCallback();
  }, [searchParams, router, auth]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Completing authentication...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
