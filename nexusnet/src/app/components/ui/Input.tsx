import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm text-foreground/90">
          {label}
        </label>
      )}
      <input
        className={`px-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all ${className}`}
        {...props}
      />
      {error && (
        <span className="text-sm text-destructive">{error}</span>
      )}
    </div>
  );
}
