import React from 'react';
import { Brain } from 'lucide-react';

interface MindCareLogoProps {
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  className?: string;
}

export function MindCareLogo({ size = 'md', theme = 'light', className = '' }: MindCareLogoProps) {
  const config = {
    sm:  { box: 'w-8 h-8',   icon: 'w-4 h-4',   name: 'text-sm',   tag: 'text-[9px]'  },
    md:  { box: 'w-10 h-10', icon: 'w-5 h-5',   name: 'text-lg',   tag: 'text-[10px]' },
    lg:  { box: 'w-12 h-12', icon: 'w-6 h-6',   name: 'text-xl',   tag: 'text-xs'     },
  }[size];

  const nameColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const tagColor  = theme === 'dark' ? 'text-white/60' : 'text-gray-400';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${config.box} rounded-xl bg-primary/10 flex items-center justify-center shrink-0`}>
        <Brain className={`${config.icon} text-primary`} />
      </div>
      <div className="leading-none">
        <span className={`font-bold ${nameColor} leading-none block ${config.name}`}>
          Mind<span className="text-primary">Care</span>
        </span>
        <span className={`font-medium leading-none mt-0.5 block ${tagColor} ${config.tag}`}>
          AI-Powered Mental Wellness
        </span>
      </div>
    </div>
  );
}
