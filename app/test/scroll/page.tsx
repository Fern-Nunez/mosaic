import { Suspense } from "react";
import ScrollDemo from "./scrollDemo";

export const metadata = {
  title: "Scroll assembly — Mosaic",
};

export default function ScrollTestPage() {
  // useSearchParams needs a Suspense boundary on a statically rendered route.
  return (
    <Suspense>
      <ScrollDemo />
    </Suspense>
  );
}
