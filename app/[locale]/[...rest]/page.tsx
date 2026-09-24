import { notFound } from "next/navigation";

// Any unknown /{locale}/* URL (typo, old link…) → the branded 404 below,
// instead of Next's bare default page.
export default function UnknownRoute() {
  notFound();
}
