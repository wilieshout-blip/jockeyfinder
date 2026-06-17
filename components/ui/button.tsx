import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger" | "inverse";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-zinc-800 active:bg-zinc-900 shadow-sm",
  accent: "bg-turf-700 text-white hover:bg-turf-600 active:bg-turf-800 shadow-sm",
  outline:
    "border border-line bg-white text-ink hover:border-zinc-400 hover:bg-mist",
  ghost: "text-zinc-700 hover:bg-mist",
  inverse:
    "border border-zinc-600 bg-transparent text-white hover:border-zinc-400 hover:bg-zinc-800",
  danger: "border border-line bg-white text-red-700 hover:bg-red-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold",
    "transition-all focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-turf-600 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
