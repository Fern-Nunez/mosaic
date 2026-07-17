"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { LayoutGrid } from "lucide-react"

import { login, signup, type AuthState } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [loginState, loginAction, loginPending] = useActionState<
    AuthState,
    FormData
  >(login, null)
  const [signupState, signupAction, signupPending] = useActionState<
    AuthState,
    FormData
  >(signup, null)

  const state = mode === "login" ? loginState : signupState
  const pending = mode === "login" ? loginPending : signupPending

  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayoutGrid className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Mosaic</h1>
          <p className="text-sm text-muted-foreground">
            Your life, in one picture.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "login" ? "Welcome back" : "Create an account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Sign in to see your dashboard."
                : "Sign up with your email and a password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={mode === "login" ? loginAction : signupAction}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={6}
                  required
                />
              </div>

              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}
              {state?.message && (
                <p className="text-sm text-muted-foreground">{state.message}</p>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in"
                    : "Sign up"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  No account?{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                    onClick={() => setMode("login")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
