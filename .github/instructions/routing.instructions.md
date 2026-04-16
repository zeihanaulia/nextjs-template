---
name: "Next.js Routing"
description: "Rules for adding or modifying pages and routes in nextjs-template"
applyTo: "pages/**/*.tsx"
---

# Routing Rules

## Page files

| File | Route | Purpose |
|---|---|---|
| `pages/index.tsx` | `/` | Root — loads `noteIndex` via `getStaticPropsUtil` |
| `pages/[...slug].tsx` | `/:slug+` | All notes — slug maps to `note.fname.split(".")` |
| `pages/refs/[id].tsx` | `/refs/:id` | Note reference panels |
| `pages/404.tsx` | `/404` | Not found |
| `pages/500.tsx` | `/500` | Server error |

## Rules

1. **Never use `[[...slug]].tsx`** (optional catch-all). It conflicts with `index.tsx` on `/`.
2. Import paths from `pages/` always use `../` to reach `components/` or `utils/`.
3. New pages that handle note content must use `getStaticPaths` + `getStaticProps` from `utils/build.ts`.
4. The slug format is always `string[]` matching `note.fname.split(".")`.

## getStaticProps pattern for note pages

```tsx
export const getStaticProps: GetStaticProps<DendronNotePageProps, DendronNotePageParams> =
  async ({ params }) => {
    const { slug } = params!;
    const note = getNoteBySlugPath(slug);
    if (!note) return { notFound: true };
    // ...
  };
```
