import React from "react";

export interface OnboardingTourProps {
  isActive?: boolean;
  onEnd?: () => void;
}

export function OnboardingTour({
  isActive,
  onEnd,
}: OnboardingTourProps = {}) {
  return null;
}

export default OnboardingTour;
