import type { Metadata } from "next";
import "./test.css";
import GlassLab from "./GlassLab";

export const metadata: Metadata = {
  title: "Glass lab — Mosaic",
  description: "Scratch page for Three.js glass/transmission materials.",
};

export default function TestPage() {
  return <GlassLab />;
}
