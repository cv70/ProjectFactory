import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface MetricProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  progress?: number;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorClasses = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  red: 'text-red-500',
};

const progressColorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Metric({ label, value, icon: Icon, trend, progress, color = 'blue', size = 'md', className = '' }: MetricProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} className={colorClasses[color]} />}
        <span className={`text-xs ${colorClasses[color]}`}>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`font-semibold ${sizeClasses[size]}`}>{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      {progress !== undefined && (
        <motion.div
          className="h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
        >
          <motion.div
            className={`h-full ${progressColorClasses[color]}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </div>
  );
}
