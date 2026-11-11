import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// Web app manifest (served at /manifest.webmanifest, linked automatically).
// Needed so the site can be added to a phone's home screen - which on iPhone
// is the only way a website is allowed to receive push notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - ราคาทองคำแท่ง ทองรูปพรรณ`,
    short_name: "ราคาทอง",
    description: SITE_DESCRIPTION,
    lang: "th",
    dir: "ltr",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#f59e0b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The artwork is full-bleed with its content inside the safe zone, so
      // the same file works when Android crops it to a circle or squircle.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
