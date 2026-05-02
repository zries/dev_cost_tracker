import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				bg: {
					base: 'rgb(var(--bg-base) / <alpha-value>)',
					subtle: 'rgb(var(--bg-subtle) / <alpha-value>)',
					muted: 'rgb(var(--bg-muted) / <alpha-value>)'
				},
				fg: {
					base: 'rgb(var(--fg-base) / <alpha-value>)',
					muted: 'rgb(var(--fg-muted) / <alpha-value>)',
					subtle: 'rgb(var(--fg-subtle) / <alpha-value>)'
				},
				border: {
					DEFAULT: 'rgb(var(--border) / <alpha-value>)',
					strong: 'rgb(var(--border-strong) / <alpha-value>)'
				},
				accent: {
					DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
					fg: 'rgb(var(--accent-fg) / <alpha-value>)'
				},
				danger: 'rgb(var(--danger) / <alpha-value>)',
				success: 'rgb(var(--success) / <alpha-value>)'
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
				mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
			}
		}
	},
	plugins: [forms({ strategy: 'class' })]
};
