import React from 'react';

interface CorpCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  noPadding?: boolean;
}

export const CorpCard: React.FC<CorpCardProps> = ({ 
  children, 
  title, 
  className = '',
  noPadding = false
}) => {
  return (
    <div className={`bg-white border border-corp-border ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-corp-border">
          <h3 className="text-lg font-serif text-corp-text font-semibold">{title}</h3>
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};
