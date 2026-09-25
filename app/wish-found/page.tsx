import type { Metadata } from "next";

import { FoundWishView } from "@/app/components/FoundWishView";

export const metadata: Metadata = {
  title: "Your Wish | WishBottle",
};

export default function WishFoundPage() {
  return <FoundWishView />;
}
