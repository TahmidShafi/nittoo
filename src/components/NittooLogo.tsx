// ==============================================================================
// Nittoo Official Brand Logo Component
// Renders official wordmark or stylized bottle icon mark with leaf & coral dot
// ==============================================================================

import React from 'react';
import { Link } from 'react-router-dom';

interface NittooLogoProps {
  variant?: 'full' | 'mark' | 'horizontal';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  clickable?: boolean;
  className?: string;
}

export const NittooLogo: React.FC<NittooLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  showTagline = false,
  clickable = false,
  className = '',
}) => {
  // Height presets for different sizes
  const heightStyles = {
    sm: 'h-7',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-14',
  };

  const markSizeStyles = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  // The standalone vector icon mark (stylized 'n' bottle dispenser + leaf + coral dot)
  const IconMark = () => (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${markSizeStyles[size]} flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}
      aria-hidden="true"
    >
      {/* Leaf Accent */}
      <path
        d="M20 7C20 7 28 6 29 16C29 16 21 17 20 7Z"
        fill="#52B788"
      />
      {/* Coral / Peach Dot */}
      <circle cx="34" cy="18" r="3.5" fill="#F07167" />
      {/* Stylized Arch 'n' */}
      <path
        d="M10 40V24C10 16.27 16.27 10 24 10C31.73 10 38 16.27 38 24V40H31V24C31 20.13 27.87 17 24 17C20.13 17 17 20.13 17 24V40H10Z"
        fill="#0C3823"
      />
      {/* Inner Pump Dispenser Cutout */}
      <path
        d="M21.5 30H26.5V40H21.5V30ZM20.5 27.5H27.5V29.5H20.5V27.5ZM22.5 25.5H25.5V27.5H22.5V25.5ZM19.5 25.5H23.5V23.5C23.5 23 23.2 22.5 22.5 22.5H19.5V25.5Z"
        fill="#FBFBFB"
      />
    </svg>
  );

  const LogoContent = (
    <div className={`inline-flex flex-col ${className}`}>
      {variant === 'mark' ? (
        <IconMark />
      ) : (
        <div className="flex items-center gap-2">
          {/* Brand Logo Image with automatic aspect ratio */}
          <img
            src="/nittoo-logo.png"
            alt="Nittoo Logo"
            className={`${heightStyles[size]} w-auto object-contain select-none`}
            draggable={false}
          />
        </div>
      )}

      {showTagline && (
        <span className="text-[11px] font-medium tracking-wide text-neutral-400 mt-1 uppercase letter-spacing-wider">
          Know What Lasts.
        </span>
      )}
    </div>
  );

  if (clickable) {
    return (
      <Link
        to="/dashboard"
        className="group inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] rounded-lg p-0.5"
        aria-label="Nittoo Home"
      >
        {LogoContent}
      </Link>
    );
  }

  return LogoContent;
};
