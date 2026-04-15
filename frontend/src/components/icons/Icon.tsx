import React from 'react';

interface IconProps {
  children: React.ReactNode;
  size?: number;
  className?: string;
  color?: string;
}

export function Icon({ children, size = 16, className, color }: IconProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, color }}
    >
      {children}
    </span>
  );
}
