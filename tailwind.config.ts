import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        roboto: ['Roboto', 'system-ui', 'sans-serif'],
        'roboto-mono': ['Roboto Mono', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "hsl(227, 100%, 97%)",
          100: "hsl(225, 96%, 92%)",
          200: "hsl(224, 96%, 85%)",
          300: "hsl(224, 96%, 78%)",
          400: "hsl(224, 94%, 69%)",
          500: "hsl(var(--md-primary))",
          600: "hsl(var(--md-primary))",
          700: "hsl(var(--md-primary-variant))",
          800: "hsl(var(--md-primary-dark))",
          900: "hsl(213, 94%, 18%)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          50: "hsl(316, 100%, 97%)",
          100: "hsl(315, 96%, 92%)",
          200: "hsl(var(--md-secondary-light))",
          300: "hsl(314, 47%, 67%)",
          400: "hsl(313, 54%, 59%)",
          500: "hsl(var(--md-secondary))",
          600: "hsl(var(--md-secondary))",
          700: "hsl(312, 56%, 40%)",
          800: "hsl(311, 56%, 33%)",
          900: "hsl(var(--md-secondary-variant))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--md-success))",
          foreground: "hsl(var(--md-on-success))",
          container: "hsl(var(--md-success-container))",
        },
        warning: {
          DEFAULT: "hsl(var(--md-warning))",
          foreground: "hsl(var(--md-on-warning))",
          container: "hsl(var(--md-warning-container))",
        },
        error: {
          DEFAULT: "hsl(var(--md-error))",
          foreground: "hsl(var(--md-on-error))",
          container: "hsl(var(--md-error-container))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'md-small': 'var(--md-shape-corner-small)',
        'md-medium': 'var(--md-shape-corner-medium)', 
        'md-large': 'var(--md-shape-corner-large)',
        'md-extra-large': 'var(--md-shape-corner-extra-large)',
      },
      spacing: {
        'md-1': 'var(--md-spacing-1)',
        'md-2': 'var(--md-spacing-2)',
        'md-3': 'var(--md-spacing-3)',
        'md-4': 'var(--md-spacing-4)',
        'md-5': 'var(--md-spacing-5)',
        'md-6': 'var(--md-spacing-6)',
        'md-7': 'var(--md-spacing-7)',
        'md-8': 'var(--md-spacing-8)',
        'md-10': 'var(--md-spacing-10)',
        'md-12': 'var(--md-spacing-12)',
        'md-16': 'var(--md-spacing-16)',
        'md-20': 'var(--md-spacing-20)',
        'md-24': 'var(--md-spacing-24)',
      },
      opacity: {
        '8': '0.08',
        '12': '0.12',
        '16': '0.16',
        '20': '0.20',
        '38': '0.38',
        '87': '0.87',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(8px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-out": {
          "0%": {
            opacity: "1",
            transform: "translateY(0)",
          },
          "100%": {
            opacity: "0",
            transform: "translateY(8px)",
          },
        },
        "scale-in": {
          "0%": {
            opacity: "0",
            transform: "scale(0.95)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        "scale-out": {
          "0%": {
            opacity: "1",
            transform: "scale(1)",
          },
          "100%": {
            opacity: "0",
            transform: "scale(0.95)",
          },
        },
        "slide-in-from-left": {
          "0%": {
            transform: "translateX(-100%)",
          },
          "100%": {
            transform: "translateX(0)",
          },
        },
        "slide-out-to-left": {
          "0%": {
            transform: "translateX(0)",
          },
          "100%": {
            transform: "translateX(-100%)",
          },
        },
        "ripple": {
          "to": {
            transform: "scale(4)",
            opacity: "0",
          },
        },
        "pulse-red": {
          "0%, 100%": {
            backgroundColor: "hsl(var(--destructive) / 0.1)",
            borderColor: "hsl(var(--destructive) / 0.3)",
          },
          "50%": {
            backgroundColor: "hsl(var(--destructive) / 0.2)",
            borderColor: "hsl(var(--destructive) / 0.5)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-out": "fade-out 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-out": "scale-out 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-from-left": "slide-in-from-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-out-to-left": "slide-out-to-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "ripple": "ripple 0.6s linear",
        "pulse-red": "pulse-red 2s ease-in-out infinite",
      },
      transitionTimingFunction: {
        'md-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
        'md-emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        'md-emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        'md-standard': 'cubic-bezier(0.2, 0, 0, 1)',
        'md-standard-decelerate': 'cubic-bezier(0, 0, 0, 1)',
        'md-standard-accelerate': 'cubic-bezier(0.3, 0, 1, 1)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
