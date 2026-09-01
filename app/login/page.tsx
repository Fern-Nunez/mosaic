"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import gsap from "gsap"

import { login, signup, type AuthState } from "./actions"
import "../auth.css"

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"
/* matches the breakpoint in auth.css where the picture side appears */
const DESKTOP = "(min-width: 1024px)"

type Mode = "login" | "signup"

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login")
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

  const pageRef = useRef<HTMLElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const hasMounted = useRef(false)

  /* the video is a 40MB asset behind a desktop-only panel. display:none on
     the parent does not stop the download, so keep it out of the DOM until
     the breakpoint actually matches. */
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP)
    const sync = () => setShowVideo(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

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

  /* mode switch — the card contents replay the same staggered fade-up they
     do on load, so switching feels like the page arriving again */
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    if (window.matchMedia(REDUCED_MOTION).matches) return

    const card = cardRef.current
    if (!card) return

    const targets = card.querySelectorAll(".loginReveal")
    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.06,
        /* the entrance timeline owns these same props — overwrite stops
           the two from fighting if a switch lands mid-entrance */
        overwrite: "auto",
      }
    )

    return () => {
      tween.kill()
      gsap.set(targets, { opacity: 1, y: 0 })
    }
  }, [mode])


  return (
    <main className="loginPage" ref={pageRef}>
      <section className="loginFormSide">
        <div className="loginFormWrapper">
          <div className="loginCard" ref={cardRef}>
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

            <h1 className="loginCardTitle loginReveal">
              {mode === "login" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="loginCardDescription loginReveal">
              {mode === "login"
                ? "Sign in to see your dashboard."
                : "Sign up with your email and a password."}
            </p>

            <form
              action={mode === "login" ? loginAction : signupAction}
              className="loginForm"
            >
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

              <div className="loginField loginReveal">
                <div className="loginLabelRow">
                  <label htmlFor="password">Password</label>
                  {mode === "login" && (
                    <Link href="/forgot-password" className="loginForgotLink">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <input
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

              {state?.error && <p className="loginError">{state.error}</p>}
              {state?.message && (
                <p className="loginMessage">{state.message}</p>
              )}

              <button
                type="submit"
                className="loginSubmit loginReveal"
                disabled={pending}
              >
                {pending
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in"
                    : "Sign up"}
              </button>
            </form>

            <p className="loginSwitch loginReveal">
              {mode === "login" ? (
                <>
                  No account?{" "}
                  <button
                    type="button"
                    className="loginSwitchButton"
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
                    className="loginSwitchButton"
                    onClick={() => setMode("login")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* decorative — silent, looping, non-interactive background */}
      <aside className="loginImageSide">
        {showVideo && (
          <video
            className="loginVideo"
            src="/images/homepage/mosaic.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
      </aside>

    </main>
  )
}
