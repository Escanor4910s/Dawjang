import React from "react";
import {
  DawJangDragonIcon,
  DawJangWordmark,
  DawJangLogo as LockedDawJangLogo,
  type DawJangLogoProps as LockedDawJangLogoProps,
} from "@/components/landing/HippocampusLogo";

export interface DawJangLogoProps extends LockedDawJangLogoProps {
  className?: string;
}

/**
 * Composant unifié redirigeant vers la version officielle verrouillée du Dragon "D" DawJang
 * (100% transparent, zéro fond blanc, extrait vectoriel pur).
 */
export const DawJangLogo: React.FC<DawJangLogoProps> = ({
  className = "w-10 h-10",
  showText = false,
  ...rest
}) => {
  if (showText) {
    return <LockedDawJangLogo className={className} showText {...rest} />;
  }
  return <DawJangDragonIcon className={className} />;
};

export { DawJangDragonIcon, DawJangWordmark };
export default DawJangLogo;
