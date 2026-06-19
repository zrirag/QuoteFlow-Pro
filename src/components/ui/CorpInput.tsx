import React from 'react';

interface CorpInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const CorpInput: React.FC<CorpInputProps> = ({ 
  label, 
  error, 
  className = '', 
  id,
  ...props 
}) => {
  const inputId = id || label?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className={`flex flex-col mb-4 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 text-xs font-semibold text-corp-text-sec uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`border border-corp-border bg-white px-3 py-2.5 text-sm text-corp-text placeholder-corp-text-muted focus:outline-none focus:border-corp-accent focus:ring-1 focus:ring-corp-accent transition-colors ${
          error ? 'border-red-500' : ''
        }`}
        {...props}
      />
      {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
    </div>
  );
};
