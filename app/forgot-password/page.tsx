"use client"

import { useActionState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import gsap from "gsap"

import { requestPasswordReset, type AuthState } from "@/app/login/actions"
import "../auth.css"

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    null
  )

  const pageRef = useRef<HTMLElement>(null)

  /* entrance — only the card's contents animate. The picture is left
     alone on purpose: these pages remount on every navigation, so
     animating it would replay the fade each time you move between them. */
  useEffect(() => {
    const reduced = window.matchMedia(REDUCED_MOTION).matches

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(".loginReveal", { opacity: 1, y: 0 })
        return
      }

      gsap.fromTo(
        ".loginReveal",
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.06,
        }
      )
    }, pageRef)

    return () => ctx.revert()
  }, [])

  return (
    <main className="loginPage" ref={pageRef}>
      <section className="loginFormSide">
        <div className="loginFormWrapper">
          <div className="loginCard">
            <div className="loginBrand loginReveal">
              <div className="loginBrandIcon">
                <Image
                  src="/branding/logo.svg"
                  alt="Mosaic"
                  width={44}
                  height={44}
                  className="loginBrandLogo"
                />
              </div>
            </div>

            <h1 className="loginCardTitle loginReveal">Reset your password</h1>
            <p className="loginCardDescription loginReveal">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form action={action} className="loginForm">
              <div className="loginField loginReveal">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              {state?.error && <p className="loginError">{state.error}</p>}
              {state?.message && (
                <p className="loginMessage">{state.message}</p>
              )}

              <button
                type="submit"
                className="loginSubmit loginReveal"
                disabled={pending}
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="loginSwitch loginReveal">
              Remembered it?{" "}
              <Link href="/login" className="loginSwitchLink">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* decorative — swap the src for whatever image you want */}
      <aside className="loginImageSide">
        <Image
          src="/images/homepage/placeholder.jpg"
          alt=""
          fill
          className="loginImage"
          sizes="50vw"
          priority
        />
      </aside>
    </main>
  )
}
