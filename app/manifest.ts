import type { MetadataRoute } from "next"

/** Lets Mosaic be added to the home screen, which iPhones need for push. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mosaic",
    short_name: "Mosaic",
    description: "Your life, in one picture all working together",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F4F4F4",
    theme_color: "#F4F4F4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
