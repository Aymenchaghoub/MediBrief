import Link from "next/link";
import { ClipboardPlus } from "lucide-react";

export function Brand() {
  return (
    <Link href="/" className="brand-wordmark" aria-label="MediBrief home">
      <span className="brand-mark">
        <ClipboardPlus size={18} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span>MediBrief</span>
    </Link>
  );
}
