import { db } from './index';
import { tags } from './schema';

export const TAG_CATEGORIES = [
	'Language',
	'Frontend',
	'Framework',
	'Runtime',
	'Database',
	'Hosting',
	'DevOps',
	'Tooling',
	'IDE',
	'Mobile',
	'AI',
	'Auth',
	'Observability',
	'Payments',
	'Email',
	'Storage',
	'CMS',
	'Design'
] as const;

export type TagCategory = (typeof TAG_CATEGORIES)[number];

export const DEFAULT_TAGS: Array<{ name: string; category: TagCategory }> = [
	// Language
	{ name: 'JavaScript', category: 'Language' },
	{ name: 'TypeScript', category: 'Language' },
	{ name: 'Python', category: 'Language' },
	{ name: 'PHP', category: 'Language' },
	{ name: 'Go', category: 'Language' },
	{ name: 'Rust', category: 'Language' },
	{ name: 'Ruby', category: 'Language' },
	{ name: 'C#', category: 'Language' },
	{ name: 'Java', category: 'Language' },
	{ name: 'Kotlin', category: 'Language' },
	{ name: 'Swift', category: 'Language' },
	{ name: 'Elixir', category: 'Language' },
	{ name: 'Dart', category: 'Language' },

	// Frontend
	{ name: 'React', category: 'Frontend' },
	{ name: 'Vue', category: 'Frontend' },
	{ name: 'Svelte', category: 'Frontend' },
	{ name: 'Angular', category: 'Frontend' },
	{ name: 'Solid', category: 'Frontend' },
	{ name: 'Lit', category: 'Frontend' },
	{ name: 'htmx', category: 'Frontend' },
	{ name: 'Alpine.js', category: 'Frontend' },
	{ name: 'jQuery', category: 'Frontend' },

	// Framework
	{ name: 'Next.js', category: 'Framework' },
	{ name: 'Nuxt', category: 'Framework' },
	{ name: 'SvelteKit', category: 'Framework' },
	{ name: 'Remix', category: 'Framework' },
	{ name: 'Astro', category: 'Framework' },
	{ name: 'Gatsby', category: 'Framework' },
	{ name: 'Laravel', category: 'Framework' },
	{ name: 'Rails', category: 'Framework' },
	{ name: 'Django', category: 'Framework' },
	{ name: 'Flask', category: 'Framework' },
	{ name: 'FastAPI', category: 'Framework' },
	{ name: 'Express', category: 'Framework' },
	{ name: 'NestJS', category: 'Framework' },
	{ name: 'Spring Boot', category: 'Framework' },
	{ name: 'ASP.NET', category: 'Framework' },
	{ name: 'Phoenix', category: 'Framework' },

	// Runtime
	{ name: 'Node.js', category: 'Runtime' },
	{ name: 'Bun', category: 'Runtime' },
	{ name: 'Deno', category: 'Runtime' },
	{ name: 'PHP-FPM', category: 'Runtime' },
	{ name: 'JVM', category: 'Runtime' },
	{ name: '.NET', category: 'Runtime' },

	// Database
	{ name: 'PostgreSQL', category: 'Database' },
	{ name: 'MySQL', category: 'Database' },
	{ name: 'SQLite', category: 'Database' },
	{ name: 'MariaDB', category: 'Database' },
	{ name: 'MongoDB', category: 'Database' },
	{ name: 'Redis', category: 'Database' },
	{ name: 'DynamoDB', category: 'Database' },
	{ name: 'Firestore', category: 'Database' },
	{ name: 'Supabase', category: 'Database' },
	{ name: 'PlanetScale', category: 'Database' },
	{ name: 'Turso', category: 'Database' },

	// Hosting
	{ name: 'Vercel', category: 'Hosting' },
	{ name: 'Netlify', category: 'Hosting' },
	{ name: 'Cloudflare', category: 'Hosting' },
	{ name: 'AWS', category: 'Hosting' },
	{ name: 'GCP', category: 'Hosting' },
	{ name: 'Azure', category: 'Hosting' },
	{ name: 'DigitalOcean', category: 'Hosting' },
	{ name: 'Fly.io', category: 'Hosting' },
	{ name: 'Railway', category: 'Hosting' },
	{ name: 'Render', category: 'Hosting' },
	{ name: 'Hetzner', category: 'Hosting' },
	{ name: 'Linode', category: 'Hosting' },
	{ name: 'Heroku', category: 'Hosting' },
	{ name: 'Proxmox', category: 'Hosting' },

	// DevOps
	{ name: 'Docker', category: 'DevOps' },
	{ name: 'Kubernetes', category: 'DevOps' },
	{ name: 'Terraform', category: 'DevOps' },
	{ name: 'GitHub Actions', category: 'DevOps' },
	{ name: 'GitLab CI', category: 'DevOps' },
	{ name: 'CircleCI', category: 'DevOps' },
	{ name: 'Ansible', category: 'DevOps' },
	{ name: 'Pulumi', category: 'DevOps' },
	{ name: 'Nginx', category: 'DevOps' },
	{ name: 'Caddy', category: 'DevOps' },
	{ name: 'Traefik', category: 'DevOps' },

	// Tooling
	{ name: 'Vite', category: 'Tooling' },
	{ name: 'Webpack', category: 'Tooling' },
	{ name: 'esbuild', category: 'Tooling' },
	{ name: 'Turbopack', category: 'Tooling' },
	{ name: 'Rollup', category: 'Tooling' },
	{ name: 'pnpm', category: 'Tooling' },
	{ name: 'npm', category: 'Tooling' },
	{ name: 'Laravel Herd', category: 'Tooling' },
	{ name: 'MAMP', category: 'Tooling' },
	{ name: 'XAMPP', category: 'Tooling' },

	// IDE
	{ name: 'VS Code', category: 'IDE' },
	{ name: 'JetBrains', category: 'IDE' },
	{ name: 'Cursor', category: 'IDE' },
	{ name: 'Claude Code', category: 'IDE' },
	{ name: 'GitHub Copilot', category: 'IDE' },
	{ name: 'Windsurf', category: 'IDE' },
	{ name: 'Zed', category: 'IDE' },

	// Mobile
	{ name: 'iOS', category: 'Mobile' },
	{ name: 'Android', category: 'Mobile' },
	{ name: 'React Native', category: 'Mobile' },
	{ name: 'Flutter', category: 'Mobile' },
	{ name: 'Expo', category: 'Mobile' },
	{ name: 'Capacitor', category: 'Mobile' },
	{ name: 'Tauri', category: 'Mobile' },

	// AI
	{ name: 'OpenAI', category: 'AI' },
	{ name: 'Anthropic', category: 'AI' },
	{ name: 'Gemini', category: 'AI' },
	{ name: 'Ollama', category: 'AI' },
	{ name: 'OpenRouter', category: 'AI' },
	{ name: 'Hugging Face', category: 'AI' },
	{ name: 'LangChain', category: 'AI' },
	{ name: 'LlamaIndex', category: 'AI' },

	// Auth
	{ name: 'Auth0', category: 'Auth' },
	{ name: 'Clerk', category: 'Auth' },
	{ name: 'Supabase Auth', category: 'Auth' },
	{ name: 'Firebase Auth', category: 'Auth' },
	{ name: 'NextAuth', category: 'Auth' },
	{ name: 'Keycloak', category: 'Auth' },
	{ name: 'WorkOS', category: 'Auth' },
	{ name: 'Cognito', category: 'Auth' },

	// Observability
	{ name: 'Sentry', category: 'Observability' },
	{ name: 'Datadog', category: 'Observability' },
	{ name: 'New Relic', category: 'Observability' },
	{ name: 'PostHog', category: 'Observability' },
	{ name: 'Plausible', category: 'Observability' },
	{ name: 'Grafana', category: 'Observability' },
	{ name: 'Honeycomb', category: 'Observability' },
	{ name: 'Better Stack', category: 'Observability' },

	// Payments
	{ name: 'Stripe', category: 'Payments' },
	{ name: 'Paddle', category: 'Payments' },
	{ name: 'Lemon Squeezy', category: 'Payments' },
	{ name: 'Square', category: 'Payments' },
	{ name: 'PayPal', category: 'Payments' },

	// Email
	{ name: 'Resend', category: 'Email' },
	{ name: 'Postmark', category: 'Email' },
	{ name: 'SendGrid', category: 'Email' },
	{ name: 'Mailgun', category: 'Email' },
	{ name: 'AWS SES', category: 'Email' },
	{ name: 'Loops', category: 'Email' },

	// Storage
	{ name: 'S3', category: 'Storage' },
	{ name: 'R2', category: 'Storage' },
	{ name: 'Cloudflare CDN', category: 'Storage' },
	{ name: 'Fastly', category: 'Storage' },
	{ name: 'Bunny.net', category: 'Storage' },
	{ name: 'Backblaze B2', category: 'Storage' },

	// CMS
	{ name: 'WordPress', category: 'CMS' },
	{ name: 'Drupal', category: 'CMS' },
	{ name: 'Strapi', category: 'CMS' },
	{ name: 'Sanity', category: 'CMS' },
	{ name: 'Contentful', category: 'CMS' },
	{ name: 'Payload', category: 'CMS' },
	{ name: 'Ghost', category: 'CMS' },

	// Design
	{ name: 'Figma', category: 'Design' },
	{ name: 'Adobe CC', category: 'Design' },
	{ name: 'Framer', category: 'Design' }
];

export function seedTags(): void {
	const existing = db.select({ id: tags.id }).from(tags).limit(1).all();
	if (existing.length > 0) return;
	db.insert(tags).values(DEFAULT_TAGS).run();
	// eslint-disable-next-line no-console
	console.log(`[devcost] Seeded ${DEFAULT_TAGS.length} default tags.`);
}
