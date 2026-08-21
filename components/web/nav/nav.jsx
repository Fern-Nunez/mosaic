"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HPButton from "../homepageButton/HPButton";
import "./nav.css";

const DESKTOP_QUERY = "(min-width: 768px)";
const TOP_THRESHOLD = 40;       /* above this the bar stays transparent */
const HIDE_AFTER = 300;         /* stay put until well clear of the hero top */
const HIDE_TRAVEL = 180;        /* and until this much continuous downward scroll */

export default function Navbar() {
    const [open, setOpen] = useState(false);

    const navRef = useRef(null);
    const topRef = useRef(null);
    const midRef = useRef(null);
    const bottomRef = useRef(null);
    const panelRef = useRef(null);
    const timelineRef = useRef(null);
    const openRef = useRef(false);

    useEffect(() => {
        const top = topRef.current;
        const mid = midRef.current;
        const bottom = bottomRef.current;
        const panel = panelRef.current;

        /* distance between line centres, read from layout so the CSS gap
           stays the single source of truth for the spacing */
        const offset = mid.offsetTop - top.offsetTop;

        const ctx = gsap.context(() => {
            /* zero x explicitly: GSAP reads the CSS translateX(100%) as a px
               value, and xPercent would otherwise stack on top of it */
            gsap.set(panel, { x: 0, xPercent: 100 });

            const tl = gsap.timeline({
                paused: true,
                defaults: { duration: 0.25, ease: "power2.inOut" },
            });

            /* the panel slides across for the whole length of the timeline,
               so the X finishes drawing exactly as the panel lands */
            tl.set(panel, { visibility: "visible" }, 0)
              .to(panel, { xPercent: 0, duration: 0.5, ease: "power3.inOut" }, 0)
              /* stage one — top and bottom slide onto the middle line and
                 the bottom line grows out to match the top line's width */
              .to(top, { y: offset }, 0)
              .to(bottom, { y: -offset, width: "100%" }, 0)
              .to(mid, { opacity: 0, duration: 0.15 }, 0.1)
              /* stage two — the stacked lines open into the X */
              .to(top, { rotate: 45 }, ">")
              .to(bottom, { rotate: -45 }, "<");

            timelineRef.current = tl;
        });

        return () => ctx.revert();
    }, []);

    /* transparent at the top, frosted once scrolled, retracts on the way
       down and drops back in on the way up */
    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);

        const nav = navRef.current;
        let hidden = false;
        let lastY = window.scrollY;
        let downTravel = 0;     /* downward distance since the last reversal */

        const setHidden = (next) => {
            if (next === hidden) return;
            hidden = next;
            gsap.to(nav, {
                yPercent: next ? -100 : 0,
                duration: 0.4,
                ease: "power2.out",
            });
        };

        const handleScroll = (y) => {
            /* the menu pins the page open — never retract underneath it */
            if (openRef.current) return;

            /* written straight to the DOM rather than through state: this
               fires on every scroll frame and re-rendering the nav that
               often would be wasteful */
            nav.dataset.scrolled = String(y > TOP_THRESHOLD);

            const delta = y - lastY;
            lastY = y;

            if (y <= HIDE_AFTER) {
                downTravel = 0;
                setHidden(false);
                return;
            }

            /* retract only after a sustained run downward, so a nudge or a
               trackpad twitch never pulls the bar off screen */
            if (delta > 0) {
                downTravel += delta;
                if (downTravel >= HIDE_TRAVEL) setHidden(true);
            } else if (delta < 0) {
                downTravel = 0;     /* any upward move brings it straight back */
                setHidden(false);
            }
        };


        const ctx = gsap.context(() => {
            ScrollTrigger.create({
                start: 0,
                end: "max",
                onUpdate: (self) => handleScroll(self.scroll()),
            });
        });

        return () => ctx.revert();
    }, []);

    useEffect(() => {
        const tl = timelineRef.current;
        openRef.current = open;
        if (!tl) return;

        if (open) {
            /* make sure a retracted bar comes back before the panel opens */
            gsap.to(navRef.current, { yPercent: 0, duration: 0.3, ease: "power2.out" });
            tl.play();
        } else {
            tl.reverse();
        }
    }, [open]);

    /* close on Escape, and stop the page behind the panel from scrolling */
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event) => {
            if (event.key === "Escape") setOpen(false);
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    /* the panel is display:none on desktop, so a resize while it's open would
       otherwise leave the page scroll-locked with nothing on screen */
    useEffect(() => {
        const query = window.matchMedia(DESKTOP_QUERY);
        const onChange = (event) => {
            if (event.matches) setOpen(false);
        };

        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    return (
        <>
        <div className="navbarContainer" data-open={open} ref={navRef}>
            <Link href={"/"}>
                <div className="navLogoAndText">
                    <Image
                        src="/branding/logo.svg"
                        alt="Spending and nutrition shown side by side"
                        width={310}
                        height={310}
                        className="navLogoImage"
                    />
                    <span className="navBrandName">MOSAIC</span>
                </div>           
            </Link>

            <div className="navDesktopLinks">
                <Link href="/"><div className="navDesktopLink">Home</div></Link>
                <Link href="/dashboard"><div className="navDesktopLink">Dashboard</div></Link>
                <Link href={"/dashboard"}>
                    <HPButton/>
                </Link>
                
                
            </div>

            <button
                type="button"
                className="navHamburgerMenuContainer"
                onClick={() => setOpen((isOpen) => !isOpen)}
                aria-expanded={open}
                aria-controls="navMenuPanel"
                aria-label={open ? "Close menu" : "Open menu"}
            >
                <span ref={topRef} className="topLine"></span>
                <span ref={midRef} className="midLine"></span>
                <span ref={bottomRef} className="bottomLine"></span>
            </button>
        </div>

        <div
            id="navMenuPanel"
            className="navMenuPanel"
            ref={panelRef}
            inert={!open}
        >
            <nav className="navMenuLinks">
                <Link href="/" onClick={() => setOpen(false)}>Home</Link>
                <Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
                <Link href="/login" onClick={() => setOpen(false)}>Sign Up</Link>
            </nav>
        </div>

        </>
    );
}
