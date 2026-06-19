import React from 'react';

interface CorpButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
}

export const CorpButton: React.FC<CorpButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-6 py-2.5 text-sm font-medium transition-colors duration-200 ease-in-out inline-flex justify-center items-center";
  
  const variants = {
    primary: "bg-corp-accent text-white hover:bg-corp-text border border-transparent",
    secondary: "bg-corp-bg-sec text-corp-text hover:bg-[#EAEAEA] border border-transparent",
    outline: "bg-transparent text-corp-text border border-corp-border hover:bg-corp-bg-sec"
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
