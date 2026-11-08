// src/components/landing/HippocampusLogo.tsx
import React from "react";
import { cn } from "@/lib/utils";

export interface DawJangLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
  subtitle?: string;
  showSubtitle?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "white" | string;
}

/**
 * Extraction vectorielle pure du Dragon "D" noir
 * - 100% transparent (zéro fond blanc, zéro cadre, zéro filigrane)
 * - Identique à l'image source officielle
 */
export const DawJangDragonIcon = React.memo(function DawJangDragonIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="240 160 510 660"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      style={{ background: "transparent" }}
      aria-label="Logo DawJang"
    >
      {/* 1. Bloc supérieur gauche (Fût haut du D) */}
      <path
        d="M 278 268 L 446 268 L 394 344 L 394 378 C 365 424, 326 438, 278 426 Z"
        fill="currentColor"
      />

      {/* 2. Tête du Dragon, cornes, crête et encolure droite (avec découpe de l'œil) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 279 464 C 332 480, 386 456, 418 396 L 474 294 L 516 178 L 518 280 L 578 182 L 560 310 C 618 336, 666 372, 686 402 L 672 408 C 684 420, 692 430, 696 436 L 678 444 C 724 508, 728 594, 700 678 C 662 596, 616 536, 558 496 L 534 482 L 554 536 C 502 514, 448 514, 408 532 L 408 590 C 348 566, 296 520, 279 464 Z M 455 446 C 464 426, 482 408, 498 398 C 506 414, 504 432, 490 444 C 478 450, 464 450, 455 446 Z"
        fill="currentColor"
      />

      {/* 3. Écailles géométriques internes de la gorge */}
      <path
        d="M 490 546 L 560 568 L 555 596 L 512 584 L 502 612 L 473 602 Z"
        fill="currentColor"
      />
      <path
        d="M 472 624 L 545 650 L 536 678 L 494 662 L 484 690 L 454 678 Z"
        fill="currentColor"
      />

      {/* 4. Pilier inférieur gauche (Base verticale et angle droit du D) */}
      <path
        d="M 278 518 C 338 602, 418 676, 514 720 C 498 750, 482 774, 464 793 L 278 793 Z"
        fill="currentColor"
      />

      {/* 5. Courbe inférieure droite (Ventre arrondi du D) */}
      <path
        d="M 588 528 C 634 574, 672 642, 686 704 C 648 756, 580 788, 496 793 C 548 724, 582 636, 588 528 Z"
        fill="currentColor"
      />
    </svg>
  );
});

/**
 * Signature typographique "DawJang" :
 * - "Daw" : écriture griffonnée enfantine spontanée (Gloria Hallelujah) avec soulignement incurvé
 * - "Jang" : écriture artistique, sculpturale et ultra-propre (Cormorant Garamond / Instrument Serif)
 */
export const DawJangWordmark = React.memo(function DawJangWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dawSize =
    size === "sm"
      ? "text-[16px]"
      : size === "lg"
      ? "text-[26px]"
      : "text-[19px]";

  const jangSize =
    size === "sm"
      ? "text-[18px]"
      : size === "lg"
      ? "text-[30px]"
      : "text-[22px]";

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[2px] leading-none select-none",
        className
      )}
    >
      {/* "Daw" : Griffouillage d'enfant / Script spontané */}
      <span className="relative inline-block -rotate-[4deg] mr-[1px]">
        <span
          className={cn(
            "font-daw-scribble font-normal tracking-[-0.02em] text-foreground transition-transform duration-300 group-hover/brand:-rotate-2",
            dawSize
          )}
          style={{
            fontFamily: "'Gloria Hallelujah', 'Comic Sans MS', cursive",
          }}
        >
          Daw
        </span>
        {/* Petit trait griffonné à la main sous "Daw" */}
        <svg
          viewBox="0 0 60 10"
          fill="none"
          className="absolute -bottom-1 left-0 w-full h-[5px] text-[#C96442] opacity-85 pointer-events-none"
        >
          <path
            d="M 2 6 Q 18 2, 34 6 T 58 4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </span>

      {/* "Jang" : Artistique, calligraphié et ultra-propre */}
      <span
        className={cn(
          "font-jang-artistic font-semibold tracking-[-0.025em] text-foreground group-hover/brand:text-[#C96442] transition-colors duration-200",
          jangSize
        )}
        style={{
          fontFamily: "'Cormorant Garamond', 'Instrument Serif', Georgia, serif",
          fontFeatureSettings: '"liga" 1, "dlig" 1',
        }}
      >
        Jang
      </span>
    </span>
  );
});

export const DawJangLogo = React.memo(function DawJangLogo({
  className,
  iconClassName,
  textClassName,
  showText = true,
  subtitle = "Studio Académique",
  showSubtitle = true,
  size = "md",
  variant = "default",
}: DawJangLogoProps) {
  const iconDimensions =
    size === "sm"
      ? "h-7 w-7"
      : size === "lg"
      ? "h-11 w-11"
      : "h-9 w-9";

  const textColor = variant === "white" ? "text-white" : "text-foreground";

  return (
    <div
      className={cn(
        "group/brand inline-flex items-center gap-2.5 select-none",
        textColor,
        className
      )}
    >
      {/* Le Dragon "D" extrait pur, sans boîte ni cercle autour */}
      <DawJangDragonIcon
        className={cn(
          iconDimensions,
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/brand:scale-[1.06]",
          variant === "white" ? "text-white" : "text-current",
          iconClassName
        )}
      />

      {showText && (
        <div className="flex flex-col justify-center">
          <DawJangWordmark size={size} className={textClassName} />
          {showSubtitle && subtitle && (
            <span
              style={{
                fontFamily:
                  "'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
              className={cn(
                "text-[10px] font-medium leading-none mt-1 pl-[1px]",
                variant === "white" ? "text-white/70" : "text-muted-foreground"
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export const HippocampusLogo = DawJangLogo;
export default DawJangLogo;
