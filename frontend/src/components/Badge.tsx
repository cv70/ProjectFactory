import React from 'react';

export type BadgeVariant = 'default' | 'status' | 'complexity';
export type BadgeColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'orange';

export interface BadgeProps {
  variant?: BadgeVariant;
  color?: BadgeColor;
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorClasses: Record<BadgeColor, string> = {
  gray: 'bg-gray-600 text-white',
  blue: 'bg-blue-600 text-white',
  green: 'bg-green-600 text-white',
  yellow: 'bg-yellow-500 text-black',
  red: 'bg-red-600 text-white',
  orange: 'bg-orange-500 text-white',
};

const variantClasses: Record<BadgeVariant, string> = {
  default: '',
  status: 'text-xs font-medium px-2 py-0.5 rounded-full',
  complexity: 'text-xs px-2 py-0.5 rounded-full border border-gray-600',
};

export function Badge({ variant = 'status', color = 'gray', children, icon, size = 'md', className = '' }: BadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const baseClasses = 'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors';

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${colorClasses[color]} ${sizeClasses[size]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
