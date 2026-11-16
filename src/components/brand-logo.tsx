import { cn } from "@/lib/utils";

type BrandLogoProps = { className?: string; compact?: boolean };

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
  return (
    <img
      src={compact ? "/brand/sapucai-mark.svg" : "/brand/sapucai-tropicalis.svg"}
      alt="Sapucaí Tropicalis — Gestão contábil para igrejas"
      className={cn("block object-contain", className)}
      decoding="async"
    />
  );
}
