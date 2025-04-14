import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    className?: string;
}

export function Button({ children, className = '', ...props }: ButtonProps) {
    return (
        <button
            className={`inline-flex items-center justify-center ${className}`}
            {...props}
        >
            {children}
        </button>
    );
} 