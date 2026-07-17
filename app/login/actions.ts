"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type AuthState = {
  error?: string
  message?: string
} | null

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: error.message }
  }

  // If email confirmation is disabled, a session is created immediately
  if (data.session) {
    revalidatePath("/", "layout")
    redirect("/dashboard")
  }

  return { message: "Check your email for a confirmation link." }
}

export async function requestPasswordReset(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()

  const email = (formData.get("email") as string)?.trim()
  if (!email) {
    return { error: "Enter your email." }
  }

  // Send the user back to this same app (works for localhost and the
  // LAN address alike) to finish the reset.
  const origin = (await headers()).get("origin") ?? "http://localhost:3000"
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/change-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { message: "Check your email for a password reset link." }
}

export async function changePassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()

  const password = formData.get("password") as string
  const confirm = formData.get("confirm") as string

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." }
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
