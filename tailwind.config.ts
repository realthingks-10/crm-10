import type { Config } from "tailwindcss";

export default {
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
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		colors: {
    			border: 'hsl(var(--border) / <alpha-value>)',
    			input: 'hsl(var(--input) / <alpha-value>)',
    			ring: 'hsl(var(--ring) / <alpha-value>)',
    			background: 'hsl(var(--background) / <alpha-value>)',
    			foreground: 'hsl(var(--foreground) / <alpha-value>)',
    			primary: {
    				DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
    				foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
    				foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
    				foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
    				foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
    				foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
    				foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card) / <alpha-value>)',
    				foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background) / <alpha-value>)',
    				foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
    				primary: 'hsl(var(--sidebar-primary) / <alpha-value>)',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
    				accent: 'hsl(var(--sidebar-accent) / <alpha-value>)',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
    				border: 'hsl(var(--sidebar-border) / <alpha-value>)',
    				ring: 'hsl(var(--sidebar-ring) / <alpha-value>)'
    			},
    			stage: {
    				lead: 'hsl(var(--stage-lead) / <alpha-value>)',
    				'lead-foreground': 'hsl(var(--stage-lead-foreground) / <alpha-value>)',
    				discussions: 'hsl(var(--stage-discussions) / <alpha-value>)',
    				'discussions-foreground': 'hsl(var(--stage-discussions-foreground) / <alpha-value>)',
    				qualified: 'hsl(var(--stage-qualified) / <alpha-value>)',
    				'qualified-foreground': 'hsl(var(--stage-qualified-foreground) / <alpha-value>)',
    				rfq: 'hsl(var(--stage-rfq) / <alpha-value>)',
    				'rfq-foreground': 'hsl(var(--stage-rfq-foreground) / <alpha-value>)',
    				offered: 'hsl(var(--stage-offered) / <alpha-value>)',
    				'offered-foreground': 'hsl(var(--stage-offered-foreground) / <alpha-value>)',
    				won: 'hsl(var(--stage-won) / <alpha-value>)',
    				'won-foreground': 'hsl(var(--stage-won-foreground) / <alpha-value>)',
    				lost: 'hsl(var(--stage-lost) / <alpha-value>)',
    				'lost-foreground': 'hsl(var(--stage-lost-foreground) / <alpha-value>)',
    				dropped: 'hsl(var(--stage-dropped) / <alpha-value>)',
    				'dropped-foreground': 'hsl(var(--stage-dropped-foreground) / <alpha-value>)'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
		keyframes: {
			'accordion-down': {
				from: {
					height: '0',
					opacity: '0'
				},
				to: {
					height: 'var(--radix-accordion-content-height)',
					opacity: '1'
				}
			},
			'accordion-up': {
				from: {
					height: 'var(--radix-accordion-content-height)',
					opacity: '1'
				},
				to: {
					height: '0',
					opacity: '0'
				}
			},
			'collapsible-down': {
				from: {
					height: '0',
					opacity: '0'
				},
				to: {
					height: 'var(--radix-collapsible-content-height)',
					opacity: '1'
				}
			},
			'collapsible-up': {
				from: {
					height: 'var(--radix-collapsible-content-height)',
					opacity: '1'
				},
				to: {
					height: '0',
					opacity: '0'
				}
			},
			'fade-in': {
				'0%': {
					opacity: '0',
					transform: 'translateY(4px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			'slide-up': {
				'0%': {
					opacity: '0',
					transform: 'translateY(20px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
			'accordion-up': 'accordion-up 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
			'collapsible-down': 'collapsible-down 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
			'collapsible-up': 'collapsible-up 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
			'fade-in': 'fade-in 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
			'slide-up': 'slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)'
		},
    		fontFamily: {
    			sans: [
    				'Inter',
    				'ui-sans-serif',
    				'system-ui',
    				'-apple-system',
    				'BlinkMacSystemFont',
    				'Segoe UI',
    				'Roboto',
    				'Helvetica Neue',
    				'Arial',
    				'Noto Sans',
    				'sans-serif'
    			],
    			serif: [
    				'Lora',
    				'ui-serif',
    				'Georgia',
    				'Cambria',
    				'Times New Roman',
    				'Times',
    				'serif'
    			],
    			mono: [
    				'Space Mono',
    				'ui-monospace',
    				'SFMono-Regular',
    				'Menlo',
    				'Monaco',
    				'Consolas',
    				'Liberation Mono',
    				'Courier New',
    				'monospace'
    			]
    		},
    		boxShadow: {
    			'2xs': 'var(--shadow-2xs)',
    			xs: 'var(--shadow-xs)',
    			sm: 'var(--shadow-sm)',
    			md: 'var(--shadow-md)',
    			lg: 'var(--shadow-lg)',
    			xl: 'var(--shadow-xl)',
    			'2xl': 'var(--shadow-2xl)'
    		}
    	}
    },
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
