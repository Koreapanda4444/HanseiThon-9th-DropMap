import type { Metadata } from "next";
import { MoreExperience } from "@/components/layout/more-experience";

export const metadata: Metadata = { title: "더보기" };

export default function MorePage() {
  return <MoreExperience />;
}
