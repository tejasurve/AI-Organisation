// lib/platform/preview/scaffolder.ts
//
// Lays down a real, runnable Next.js 14 + Tailwind + Framer Motion skeleton
// under `.simulation/projects/<id>/workspace/`. The Developer LLM later fills
// in `app/page.tsx`, components, and lib files with real implementation code.
//
// We DON'T `npm install` per workspace. Instead we symlink `node_modules`
// back to the platform root — same deps, no install latency. The user can
// `cd workspace && node_modules/.bin/next dev` and it Just Works.

import { promises as fs } from "node:fs";
import path from "node:path";

const PLATFORM_ROOT = process.cwd();

/** Absolute path to a project's workspace directory. */
export function workspaceDir(projectId: string): string {
  return path.join(PLATFORM_ROOT, ".simulation", "projects", projectId, "workspace");
}

/** Has the workspace already been scaffolded? */
export async function isScaffolded(projectId: string): Promise<boolean> {
  try {
    const pkg = path.join(workspaceDir(projectId), "package.json");
    await fs.access(pkg);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scaffold a fresh Next.js workspace. Idempotent — re-running on an existing
 * workspace overwrites only the boilerplate files, never the LLM-generated
 * feature code under `app/`, `components/`, `lib/`.
 */
export async function scaffoldWorkspace(projectId: string, projectName: string): Promise<string> {
  const dir = workspaceDir(projectId);
  await fs.mkdir(dir, { recursive: true });

  // 1. Always-overwrite boilerplate (configs).
  await writeFile(path.join(dir, "package.json"), pkgJson(projectName));
  await writeFile(path.join(dir, "next.config.js"), nextConfig());
  await writeFile(path.join(dir, "tsconfig.json"), tsconfig());
  await writeFile(path.join(dir, "postcss.config.js"), postcssConfig());
  await writeFile(path.join(dir, "tailwind.config.ts"), tailwindConfig());
  await writeFile(path.join(dir, ".gitignore"), gitignore());
  await writeFile(path.join(dir, "README.md"), readme(projectName));

  // 2. Always-overwrite shell files (layout + globals).
  await fs.mkdir(path.join(dir, "app"), { recursive: true });
  await writeFile(path.join(dir, "app", "layout.tsx"), appLayout(projectName));
  await writeFile(path.join(dir, "app", "globals.css"), globalsCss());

  // 3. Default page — only write if no `app/page.tsx` exists yet, so we don't
  //    clobber the LLM-generated one on re-scaffold.
  const pagePath = path.join(dir, "app", "page.tsx");
  if (!(await exists(pagePath))) {
    await writeFile(pagePath, defaultPage(projectName));
  }

  // 4. Empty dirs the LLM is allowed to write into.
  await fs.mkdir(path.join(dir, "components"), { recursive: true });
  await fs.mkdir(path.join(dir, "lib"), { recursive: true });

  // 5. Symlink node_modules → platform root's node_modules (huge time saver).
  //    Use a RELATIVE symlink so the workspace is portable if the user moves
  //    the platform dir.
  const nmLink = path.join(dir, "node_modules");
  try {
    await fs.lstat(nmLink); // already exists?
  } catch {
    // Relative path from workspace → platform root → node_modules.
    const rel = path.relative(dir, path.join(PLATFORM_ROOT, "node_modules"));
    await fs.symlink(rel, nmLink, "dir");
  }

  return dir;
}

/**
 * Read a file from the workspace if it exists. Returns null if missing or
 * unreadable. Used by the codegen pipeline to pull the data-model contract
 * (`lib/types.ts`, `lib/mock-data.ts`) from prior sprints back into the next
 * sprint's prompt so the Developer LLM doesn't redefine types and drift
 * across sprints.
 *
 * Same allow-list as the writer — we never read outside `app/components/lib/
 * public/styles/`.
 */
export async function readWorkspaceFile(
  projectId: string,
  relPath: string,
): Promise<string | null> {
  const dir = workspaceDir(projectId);
  const clean = relPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (clean.includes("..")) return null;
  const allowedPrefixes = ["app/", "components/", "lib/", "public/", "styles/"];
  if (!allowedPrefixes.some((p) => clean.startsWith(p))) return null;
  const abs = path.join(dir, clean);
  if (!abs.startsWith(dir + path.sep)) return null;
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * Write a file from the LLM into the workspace. Confines paths to the
 * workspace dir + a safe allow-list of subdirectories so a misbehaving LLM
 * cannot escape with `../../etc/passwd`.
 */
export async function writeWorkspaceFile(
  projectId: string,
  relPath: string,
  content: string,
): Promise<{ ok: true; absolutePath: string } | { ok: false; reason: string }> {
  const dir = workspaceDir(projectId);
  // Normalise + reject parent traversals.
  const clean = relPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (clean.includes("..")) {
    return { ok: false, reason: `Path escape rejected: ${relPath}` };
  }
  const allowedPrefixes = ["app/", "components/", "lib/", "public/", "styles/"];
  if (!allowedPrefixes.some((p) => clean.startsWith(p))) {
    return { ok: false, reason: `Path outside allow-list: ${relPath}` };
  }
  const abs = path.join(dir, clean);
  // One more belt-and-braces check: resolved path must be inside workspace.
  if (!abs.startsWith(dir + path.sep)) {
    return { ok: false, reason: `Resolved path outside workspace: ${relPath}` };
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return { ok: true, absolutePath: abs };
}

// ---------- helpers ----------

async function writeFile(p: string, c: string): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, c, "utf8");
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------- boilerplate templates ----------

function pkgJson(name: string): string {
  // We mirror the platform root's deps (so the symlinked node_modules has
  // everything it needs). Versions are intentionally loose — the symlink
  // points at the platform's resolved deps anyway.
  return JSON.stringify(
    {
      name: slugify(name),
      private: true,
      version: "0.1.0",
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        next: "14.2.35",
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "framer-motion": "^11.11.17",
      },
      devDependencies: {
        "@types/node": "^22.0.0",
        "@types/react": "^18.3.12",
        "@types/react-dom": "^18.3.1",
        autoprefixer: "^10.4.20",
        postcss: "^8.4.49",
        tailwindcss: "^3.4.15",
        typescript: "^5.6.0",
      },
    },
    null,
    2,
  );
}

function nextConfig(): string {
  return `/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // We compile via the platform's TS so we don't break the parent build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
`;
}

function tsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: false,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        baseUrl: ".",
        paths: {
          "@/*": ["./*"],
        },
        plugins: [{ name: "next" }],
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2,
  );
}

function postcssConfig(): string {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}

function tailwindConfig(): string {
  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
`;
}

function gitignore(): string {
  return `node_modules
.next
.env*.local
*.log
.DS_Store
`;
}

function readme(name: string): string {
  return `# ${name}

This is the **workspace** generated by the AI Organisation platform for project _${name}_.

Real source files in here were written by the Developer agent during sprint
execution; configs and shell files (\`layout.tsx\`, \`globals.css\`) were
scaffolded.

## Run locally

The platform already symlinked \`node_modules\` to its own install, so you can
just:

\`\`\`bash
cd "$(pwd)"
node_modules/.bin/next dev -p 5000
\`\`\`

Or use the **Preview** button in the dashboard.
`;
}

function appLayout(name: string): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${name}",
  description: "Generated by the AI Organisation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
`;
}

function globalsCss(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html, body {
  background: #0a0a0f;
  color: #f4f4f5;
}
`;
}

function defaultPage(name: string): string {
  return `export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">${name}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Workspace scaffolded — the Developer agent will fill this in shortly.
        </p>
      </div>
    </main>
  );
}
`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "ai-org-app";
}
