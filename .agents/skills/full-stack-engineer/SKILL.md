---
name: react-typescript-patterns
description: Deep reference for React/TypeScript patterns -- React 19 hooks, Vike SSR, component composition, type safety, testing with Vitest/RTL, accessibility, data fetching with TanStack Query, CodeMirror integration, and performance. Grounded in patterns from a production Vike + React 19 app.
origin: claude-react-typescript (audited and rebuilt for nunchuck-skills)
---

# React / TypeScript Patterns

Production patterns for React 19 applications with TypeScript. Covers Vike (primary SSR framework), React Router, and Next.js App Router. Focused on patterns that are non-obvious or commonly gotten wrong.

> To run an automated review, use the **react-typescript-reviewer** agent or `/react-review`.

---

## Table of Contents

1. [React 19 Hooks](#react-19-hooks)
2. [TypeScript Patterns](#typescript-patterns)
3. [Component Composition](#component-composition)
4. [Hooks Deep Dive](#hooks-deep-dive)
5. [Vike Patterns](#vike-patterns)
6. [Data Fetching (TanStack Query)](#data-fetching)
7. [Testing (Vitest + RTL)](#testing)
8. [CodeMirror Integration](#codemirror-integration)
9. [Form Patterns](#form-patterns)
10. [Accessibility](#accessibility)
11. [Performance](#performance)
12. [State Management](#state-management)
13. [Next.js App Router](#nextjs-app-router)
14. [Quick Reference](#quick-reference)

---

## React 19 Hooks

### `use()` -- Unwrap Promises and Context

```tsx
// Create promise OUTSIDE the consuming component to avoid infinite Suspense loop
function UserPage({ userId }: { userId: string }) {
  const promiseRef = useRef<Promise<User> | null>(null)
  if (!promiseRef.current) {
    promiseRef.current = fetchUser(userId)
  }

  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={promiseRef.current} />
    </Suspense>
  )
}

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise) // Suspends until resolved
  return <h1>{user.name}</h1>
}

// Conditional context read (impossible with useContext)
function ThemeText({ override }: { override?: boolean }) {
  const theme = override ? 'dark' : use(ThemeContext)
  return <span className={theme}>text</span>
}
```

**Common mistakes:**
- Creating the promise inside the consuming component (infinite Suspense loop)
- Forgetting Suspense boundary (unhandled suspension)
- Forgetting Error Boundary (unhandled rejection)

### `useActionState` -- Form Actions

Replaces `useState` + `useEffect` + `isLoading` pattern for form submission:

```tsx
async function submitForm(prev: FormState, formData: FormData): Promise<FormState> {
  const result = EmailSchema.safeParse(formData.get('email'))
  if (!result.success) return { error: result.error.flatten().fieldErrors, success: false }
  await api.subscribe(result.data)
  return { error: null, success: true }
}

function SubscribeForm() {
  const [state, action, pending] = useActionState(submitForm, { error: null, success: false })
  return (
    <form action={action}>
      <input name="email" type="email" aria-invalid={!!state.error?.email} />
      <button disabled={pending}>{pending ? 'Saving...' : 'Subscribe'}</button>
    </form>
  )
}
```

### `useFormStatus` -- Must Be in a Child Component

```tsx
// GOOD: Child reads parent form status
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending}>{pending ? 'Saving...' : label}</button>
}

// BAD: useFormStatus in same component as <form> -- always returns idle
function BrokenForm() {
  const { pending } = useFormStatus() // Won't work here!
  return <form action={action}><button disabled={pending}>Save</button></form>
}
```

### `useOptimistic` -- Instant UI Feedback

```tsx
function TodoList({ todos, addTodo }: Props) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (current: Todo[], newText: string) => [
      ...current,
      { id: crypto.randomUUID(), text: newText, pending: true },
    ]
  )

  async function handleAdd(formData: FormData) {
    const text = formData.get('text') as string
    addOptimistic(text) // Show immediately
    await addTodo(text) // Server confirms or reverts
  }

  return (
    <form action={handleAdd}>
      <input name="text" required />
      <ul>
        {optimisticTodos.map(t => (
          <li key={t.id} style={{ opacity: t.pending ? 0.5 : 1 }}>{t.text}</li>
        ))}
      </ul>
    </form>
  )
}
```

### `useId` -- Stable IDs for Accessibility

```tsx
function FormField({ label, error }: { label: string; error?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      {error && <span id={`${id}-err`} role="alert">{error}</span>}
    </div>
  )
}
```

Don't use `useId` for list keys, CSS selectors, or external APIs. It generates opaque strings like `:r1:`.

### `ref` as a Regular Prop (React 19)

```tsx
// React 19: ref is just a prop. No more forwardRef.
function Input({ ref, ...props }: React.ComponentProps<'input'>) {
  return <input ref={ref} {...props} />
}
```

---

## TypeScript Patterns

### Discriminated Union Props

```tsx
type ButtonProps =
  | { variant: 'link'; href: string; onClick?: never }
  | { variant: 'button'; onClick: () => void; href?: never }
  | { variant: 'submit'; onClick?: never; href?: never }

function Button(props: ButtonProps) {
  switch (props.variant) {
    case 'link': return <a href={props.href}>Link</a>
    case 'button': return <button onClick={props.onClick}>Click</button>
    case 'submit': return <button type="submit">Submit</button>
  }
}
```

### Generic Components

```tsx
interface SelectProps<T> {
  options: T[]
  value: T
  onChange: (value: T) => void
  getLabel: (item: T) => string
  getKey: (item: T) => string
}

function Select<T>({ options, value, onChange, getLabel, getKey }: SelectProps<T>) {
  return (
    <select value={getKey(value)} onChange={e => {
      const selected = options.find(o => getKey(o) === e.target.value)
      if (selected) onChange(selected)
    }}>
      {options.map(o => <option key={getKey(o)} value={getKey(o)}>{getLabel(o)}</option>)}
    </select>
  )
}
```

### `as const satisfies` for Validated Immutable Objects

```tsx
const STATUS_MAP = {
  active: { label: 'Active', color: 'green' },
  inactive: { label: 'Inactive', color: 'gray' },
} as const satisfies Record<string, { label: string; color: string }>
// Values are narrow string literals AND structure is validated
```

### Strict Event Typing

```tsx
function handleChange(e: React.ChangeEvent<HTMLInputElement>) { setValue(e.target.value) }
function handleSubmit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault() }
function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) { if (e.key === 'Escape') close() }
```

### Parallel Schema Families (Types Pattern)

Mirror your backend schemas with separate frontend types per use case:

```tsx
// Full resource (detail view)
export interface Problem { id: string; title: string; description: string; solution_code: string; ... }
// List item (excludes expensive fields)
export interface ProblemListItem { id: string; title: string; difficulty: Difficulty; tags: string[] }
// Create payload
export interface ProblemCreate { title: string; difficulty: Difficulty; language: Language; ... }
// Update payload (all optional)
export interface ProblemUpdate { title?: string; difficulty?: Difficulty; ... }
```

---

## Component Composition

### Compound Components

```tsx
const AccordionContext = createContext<{ openItem: string | null; toggle: (id: string) => void } | null>(null)

function Accordion({ children }: { children: React.ReactNode }) {
  const [openItem, setOpenItem] = useState<string | null>(null)
  const toggle = (id: string) => setOpenItem(prev => prev === id ? null : id)
  return <AccordionContext value={{ openItem, toggle }}><div>{children}</div></AccordionContext>
}

function AccordionItem({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const ctx = use(AccordionContext)
  if (!ctx) throw new Error('Must be inside <Accordion>')
  const isOpen = ctx.openItem === id
  return (
    <div>
      <button onClick={() => ctx.toggle(id)} aria-expanded={isOpen}>{title}</button>
      {isOpen && <div>{children}</div>}
    </div>
  )
}
```

### When to Use Each Pattern

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| Plain props | Simple data flow | Props exceed 3 levels |
| Compound components | Flexible related UI with shared state | Fixed layout, one-off |
| Slots (`header`, `footer` props) | Fixed layout with customizable areas | Dynamic slot count |
| Custom hooks | Reusable stateful logic without UI | Need to render specific JSX |

---

## Hooks Deep Dive

### useEffect Cleanup

```tsx
// AbortController for fetch
useEffect(() => {
  const controller = new AbortController()
  fetchData(id, { signal: controller.signal }).then(setData).catch(err => {
    if (err.name !== 'AbortError') setError(err)
  })
  return () => controller.abort()
}, [id])

// Timer cleanup
useEffect(() => {
  const interval = setInterval(tick, 1000)
  return () => clearInterval(interval)
}, [tick])
```

### useRef for Stable Callbacks (CodeMirror Pattern)

When a library creates its own closure (editor, chart, map), use refs to keep callbacks current without recreating the instance:

```tsx
const onChangeRef = useRef(onChange)
onChangeRef.current = onChange // Update every render

useEffect(() => {
  const editor = new EditorView({
    extensions: [
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChangeRef.current?.(update.state.doc.toString())
      }),
    ],
    parent: containerRef.current!,
  })
  return () => editor.destroy()
}, []) // Empty deps -- editor created once, callback always current via ref
```

### useReducer for Complex State

Use when state has 3+ related fields, multiple action types, or next state depends on previous state:

```tsx
type Action =
  | { type: 'ADD'; text: string }
  | { type: 'TOGGLE'; id: string }
  | { type: 'SET_FILTER'; filter: 'all' | 'active' | 'completed' }

function todoReducer(state: TodoState, action: Action): TodoState {
  switch (action.type) {
    case 'ADD': return { ...state, todos: [...state.todos, { id: crypto.randomUUID(), text: action.text, completed: false }] }
    case 'TOGGLE': return { ...state, todos: state.todos.map(t => t.id === action.id ? { ...t, completed: !t.completed } : t) }
    case 'SET_FILTER': return { ...state, filter: action.filter }
  }
}
```

### SSR-Safe URL State Hook

```tsx
function useSearchParamState(key: string, defaultValue: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue
    return new URLSearchParams(window.location.search).get(key) ?? defaultValue
  })

  const setParam = useCallback((newValue: string) => {
    setValue(newValue)
    const url = new URL(window.location.href)
    if (newValue) url.searchParams.set(key, newValue)
    else url.searchParams.delete(key)
    history.replaceState({}, '', url) // replaceState, not pushState (no history pollution)
  }, [key])

  return [value, setParam]
}
```

---

## Vike Patterns

### File Structure

```
pages/
├── +config.ts                     # Global config (extends vike-react)
├── +Layout.tsx                    # Root layout
├── +Wrapper.tsx                   # Provider wrapper (QueryClient, theme)
├── +Head.tsx                      # Global <head> tags
├── _error/+Page.tsx               # Error page (404, 500)
├── app/
│   ├── +guard.ts                  # Auth check for all /app/* routes
│   ├── +Layout.tsx                # App layout (sidebar, nav)
│   ├── dashboard/+Page.tsx        # /app/dashboard
│   ├── problems/+Page.tsx         # /app/problems
│   └── decks/@id/+Page.tsx        # /app/decks/:id
└── auth/
    └── github/callback/+Page.tsx  # OAuth callback
```

### Guard Pattern (Auth)

```tsx
// pages/app/+guard.ts -- runs before data fetching
import { redirect } from 'vike/abort'

export function guard(pageContext: PageContext): void {
  const cookieStr = typeof window === 'undefined'
    ? (pageContext.headers?.cookie ?? '')
    : document.cookie

  // Check both tokens -- refresh can recover an expired access token
  if (!getCookie('access_token', cookieStr) && !getCookie('refresh_token', cookieStr)) {
    throw redirect('/')
  }
}
```

**Non-obvious:** Guards run server-side during SSR and client-side during navigation. Cookie access differs between the two (headers vs `document.cookie`).

### Layout with Auth Error Recovery

```tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { urlPathname } = usePageContext()
  const isPublicRoute = urlPathname.startsWith('/app/profile/')

  const { data: user, isError, isLoading } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    enabled: !isPublicRoute, // Don't fetch user on public pages (avoids 401)
  })

  // Auth error recovery -- redirect to login
  const isRedirecting = useRef(false)
  useEffect(() => {
    if (isError && !isPublicRoute && !isRedirecting.current) {
      isRedirecting.current = true
      logout()
      window.location.href = '/' // Hard navigation, not Vike navigate
    }
  }, [isError, isPublicRoute])

  if (isPublicRoute) return <main>{children}</main>
  if (isLoading || isError) return <LoadingScreen />
  return <LayoutWithSidebar>{children}</LayoutWithSidebar>
}
```

**Why `window.location.href`:** Vike's `navigate()` goes through the guard, which would redirect again. Hard navigation resets all client state cleanly.

### Wrapper for Providers (SSR-Safe)

```tsx
// pages/+Wrapper.tsx
export default function Wrapper({ children }: { children: React.ReactNode }) {
  // Create QueryClient per request to prevent cross-request data leaks during SSR
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

**Critical:** `useState(() => new QueryClient())` creates per-request. `const qc = new QueryClient()` at module scope leaks data between SSR requests.

### File Environment Conventions

```
+data.ts               # Server-only by default
+data.client.ts        # Client-only
+guard.server.ts       # Server-only (explicit)
credentials.server.ts  # Never sent to client (Vike enforces at build time)
```

### ClientOnly for Browser APIs

```tsx
import { ClientOnly } from 'vike-react/ClientOnly'

<ClientOnly fallback={<div className="h-64 animate-pulse bg-muted rounded" />}>
  <InteractiveChart />
</ClientOnly>
```

### Navigation Decision Matrix

| Situation | Use |
|-----------|-----|
| Inside `guard()` or `data()` | `throw redirect("/path")` from `vike/abort` |
| After form submission / event handler | `navigate("/path")` from `vike/client/router` |
| Show different page without URL change | `throw render("/path")` from `vike/abort` |
| Auth error recovery (stale state) | `window.location.href` (hard nav to reset everything) |

**Never use `window.location.href` for normal navigation.** It does a full page reload and loses all React state. The only exception is auth error recovery where you want to reset everything.

### Guard Must Be Isomorphic

Guards run server-side during SSR and client-side during navigation. Cookie access differs between the two:

```tsx
export function guard(pageContext: PageContext): void {
  const cookieStr = typeof window === 'undefined'
    ? (pageContext.headers?.cookie ?? '')  // server: read from request headers
    : document.cookie                       // client: read from document
  
  if (!getCookie('access_token', cookieStr)) {
    throw redirect('/')
  }
}
```

**Never use `+guard.client.ts` in SSR mode.** Server won't run it, so unauthenticated requests get through on first load.

### Vike Gotchas

**`+data` hooks are NOT cumulative.** Layouts stack (child inside parent), but `+data` does not. If a layout needs data, use React Query inside the component instead of `+data`.

**Named exports only for guards and data.** `export function guard()` works. `export default function guard()` silently does nothing.

**Never use `localStorage` for auth in SSR apps.** `localStorage` doesn't exist on the server. Guards run during SSR and will crash or skip the auth check. Use cookies -- they're available in both environments via `pageContext.headers.cookie` (server) and `document.cookie` (client).

**`typeof window === 'undefined'` for any browser API in guards or store init.** Guards run on both server and client. Any `window`, `document`, `localStorage`, or `navigator` reference needs the check.

---

## Data Fetching

### Query Key Factory

```tsx
export const queryKeys = {
  problems: {
    all: ['problems'] as const,
    list: (filters: Record<string, unknown>) => ['problems', filters] as const,
    detail: (id: string) => ['problem', id] as const,
  },
  decks: {
    all: ['decks'] as const,
    detail: (id: string) => ['deck', id] as const,
  },
  review: {
    all: ['review-queue'] as const,
  },
  me: ['me'] as const,
  dashboard: {
    stats: ['dashboard-stats'] as const,
  },
} as const
```

### Centralized Cache Invalidation

```tsx
// One function that knows the cascade
export function invalidateProblemsCache(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.problems.all }),
    qc.invalidateQueries({ queryKey: queryKeys.review.all }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats }),
  ])
}

// Mutations use the helper
const mutation = useMutation({
  mutationFn: archiveProblems,
  onSuccess: () => invalidateProblemsCache(queryClient),
})
```

### Service Layer (Thin Functions, No Classes)

```tsx
// services/problems.ts
export async function listProblems(params?: {
  page?: number; difficulty?: Difficulty; is_archived?: boolean
}): Promise<PaginatedResponse<ProblemListItem>> {
  const { data } = await apiClient.get('/problems', { params })
  return data
}

export async function getProblem(id: string): Promise<Problem> {
  const { data } = await apiClient.get(`/problems/${id}`)
  return data
}
```

### Axios Interceptor for Token Refresh

```tsx
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = getCookie('refresh_token')
      if (!refreshToken) return Promise.reject(error)

      const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
      setCookie('access_token', data.access_token, 30 * 60)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return apiClient(original)
    }
    return Promise.reject(error)
  }
)
```

**The `_retry` flag prevents infinite retry loops** when the refresh token itself is expired.

---

## Testing

### Setup (Global Stubs)

```tsx
// tests/setup.ts
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as any
Element.prototype.scrollIntoView = () => {}
```

### Mock Service Functions with vi.fn()

```tsx
// Always use vi.fn() wrappers (not hardcoded returns) so tests can override
const mockListProblems = vi.fn()
vi.mock('@/services/problems', () => ({
  listProblems: (...args: unknown[]) => mockListProblems(...args),
}))

// In test:
mockListProblems.mockResolvedValue({ items: [problem], total: 1 })
```

### QueryClient Wrapper

```tsx
function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}
```

### Testing Gotchas (From Production Experience)

**Module-scope constants defeat per-test mocking.** If a component evaluates `const X = someAPI` at import time, you can't change it per-test. Use `vi.hoisted()`:

```tsx
const captured = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('@/lib/config', () => ({ getConfig: () => captured.value }))

test('with config A', () => { captured.value = 'A'; /* render */ })
test('with config B', () => { captured.value = 'B'; /* render */ })
```

**React Query v5 mutation context.** `mutationFn` receives `(variables, context)`. Use `mock.mock.calls[0][0]` instead of `toHaveBeenCalledWith`:

```tsx
expect(mockArchive.mock.calls[0][0]).toEqual(['id1', 'id2'])
```

**CodeMirror callbacks.** Editor is created in a mount-only `useEffect`. Capture callbacks via `vi.hoisted()`:

```tsx
const captured = vi.hoisted(() => ({
  keymaps: [] as Array<{ key: string; run: () => boolean }>,
}))

vi.mock('@codemirror/view', () => ({
  keymap: { of: (maps: typeof captured.keymaps) => { captured.keymaps = maps; return [] } },
}))

// Test: captured.keymaps.find(k => k.key === 'Ctrl-Enter')!.run()
```

**cmdk CommandPalette.** `Command.Item` doesn't fire `onSelect` on click. Mock the whole module:

```tsx
vi.mock('cmdk', () => ({
  Command: Object.assign(
    ({ children }: any) => <div>{children}</div>,
    { Item: ({ children, onSelect }: any) => <div role="option" onClick={() => onSelect?.()}>{children}</div> }
  ),
}))
```

**DnD Kit.** Capture `onDragEnd` and call directly:

```tsx
let capturedDragEnd: ((e: DragEndEvent) => void) | null = null
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => { capturedDragEnd = onDragEnd; return children },
}))
// Test: capturedDragEnd!({ active: { id: 'p1' }, over: { id: 'p2' } })
```

**`mutateAsync` throws in tests.** Use `mutate` for error-heavy components, or suppress with `vi.spyOn(console, 'error')`.

**`null` vs `undefined`.** Types like `error?: string` accept `undefined` but reject `null` in strict mode. Match optionality exactly in mocks.

**Always run `tsc --noEmit` on test files.** Vitest ignores type errors at runtime.

**`vi.mock` must come before the import that uses it.** Vitest hoists `vi.mock` calls, but if you're mocking a module that another import depends on, declare the mock first:

```tsx
vi.mock('@/lib/cookies', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}))

// THEN import the module that uses cookies
import apiClient from '@/services/client'
```

**Use `Mock` type cast, not `vi.mocked()` for axios.** `vi.mocked()` causes tsc errors with axios types:

```tsx
import apiClient from '@/services/client'
import type { Mock } from 'vitest'

vi.mock('@/services/client', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
const mockedPost = apiClient.post as Mock
```

**Explicit `cleanup()` in beforeEach.** RTL auto-cleanup can fail in edge cases, causing "Found multiple elements" errors from DOM leaking between tests:

```tsx
import { cleanup } from '@testing-library/react'
beforeEach(() => { cleanup() })
```

**jsdom doesn't honor `max-age=0` for cookie deletion.** Clear cookies manually between tests:

```tsx
function clearCookies() {
  document.cookie.split(';').forEach(c => {
    document.cookie = `${c.split('=')[0].trim()}=; max-age=0`
  })
}
beforeEach(clearCookies)
```

---

## CodeMirror Integration

### Mount-Once Pattern

```tsx
useEffect(() => {
  const state = EditorState.create({
    doc: value,
    extensions: [
      basicSetup,
      langComp.current.of(getLangBundle(language)),
      keymap.of([
        { key: 'Ctrl-Enter', run: () => { onRunRef.current?.(); return true } },
      ]),
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChangeRef.current?.(update.state.doc.toString())
      }),
    ],
  })

  const view = new EditorView({ state, parent: containerRef.current! })
  viewRef.current = view
  return () => view.destroy()
}, []) // Mount once -- props accessed via refs
```

### Compartments for Dynamic Config

```tsx
const themeComp = useRef(new Compartment())
const langComp = useRef(new Compartment())

// Swap theme without destroying editor
useEffect(() => {
  viewRef.current?.dispatch({
    effects: themeComp.current.reconfigure(getThemeExtension(isDark)),
  })
}, [isDark])
```

**Compartment refs must be per-instance.** Sharing across component instances breaks reconfiguration.

---

## Form Patterns

### Native Forms + useActionState + Zod (Default)

For most forms -- login, signup, CRUD -- native HTML + React 19 is enough:

```tsx
const Schema = z.object({ name: z.string().min(1), email: z.string().email() })

async function submit(prev: FormState, formData: FormData): Promise<FormState> {
  const result = Schema.safeParse(Object.fromEntries(formData))
  if (!result.success) return { errors: result.error.flatten().fieldErrors }
  await api.create(result.data)
  return { errors: null, success: true }
}
```

**When to use a form library:** Multi-step wizards, 20+ fields with cross-field deps, dynamic field arrays.

---

## Accessibility

```tsx
// Interactive elements: always use semantic HTML
<button onClick={handle}>Click</button>  // not <div onClick>

// If div is unavoidable:
<div role="button" tabIndex={0} onClick={handle}
  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handle()}>Click</div>

// All clickable elements: cursor-pointer (never rely on browser default)
<button className="cursor-pointer">...</button>
<select className="cursor-pointer">...</select>

// useId for label/input pairing
const id = useId()
<label htmlFor={id}>Email</label>
<input id={id} />

// Images: always alt (empty string for decorative)
<img alt="User avatar" src={url} />
<img alt="" src={decorative} />  // screen readers skip decorative images
```

---

## Performance

### React Compiler Awareness

If React Compiler is enabled, manual `React.memo`, `useMemo`, `useCallback` are often unnecessary. Check before adding.

### Code Splitting

```tsx
const HeavyEditor = lazy(() => import('./components/CodeEditor'))

<Suspense fallback={<div className="h-64 animate-pulse" />}>
  <HeavyEditor />
</Suspense>
```

### Tree-Shakeable Imports

```tsx
// BAD: imports entire library
import _ from 'lodash'
// GOOD: import specific function
import debounce from 'lodash/debounce'
```

### Lift Constants to Module Scope

```tsx
// BAD: new array every render
function Component() {
  const options = ['a', 'b', 'c'] // recreated each render
  return <Select options={options} />
}

// GOOD: stable reference
const OPTIONS = ['a', 'b', 'c'] as const
function Component() {
  return <Select options={OPTIONS} />
}
```

---

## State Management

### Decision Tree

| Scenario | Solution |
|----------|----------|
| Server data (API responses) | TanStack Query |
| URL state (filters, search) | `useSearchParamState` or URL params |
| Form state | `useState` or `useActionState` |
| Local UI state (open/closed, selected) | `useState` |
| Complex local state (3+ related fields) | `useReducer` |
| Theme/preferences | Context + `useState` |
| Cross-component shared state | TanStack Query (if server) or Context (if client) |

**No Zustand, no Redux, no Jotai.** For most apps, React Query + local state covers everything. Add a state library only when Context re-renders become a measured problem.

---

## Next.js App Router

> Skip this section if not using Next.js.

### Server Components (Default)

```tsx
// app/dashboard/page.tsx -- no 'use client', runs on server
export default async function DashboardPage() {
  const stats = await db.query('SELECT count(*) FROM orders')
  return <div><h1>Dashboard</h1><StatsDisplay stats={stats} /><DashboardFilters /></div>
}
```

### Push `'use client'` to Leaf Components

```tsx
// BAD: entire page is client
'use client'
export default function Page() { ... }

// GOOD: only interactive parts are client
// page.tsx (server) renders <DashboardFilters /> (client leaf)
```

### Server Actions with Zod

```tsx
'use server'
export async function createPost(formData: FormData) {
  const parsed = PostSchema.safeParse({ title: formData.get('title'), content: formData.get('content') })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
  await db.insert('posts', parsed.data)
  revalidatePath('/posts')
  return { success: true }
}
```

### Loading and Error UI

```tsx
// app/dashboard/loading.tsx -- automatic Suspense boundary
export default function Loading() {
  return <div className="animate-pulse"><div className="h-8 bg-muted rounded w-1/4 mb-4" /></div>
}

// app/dashboard/error.tsx -- automatic Error Boundary
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <div role="alert"><p>{error.message}</p><button onClick={reset}>Retry</button></div>
}
```

---

## Quick Reference

| Mistake | Fix |
|---------|-----|
| `useFormStatus` in same component as `<form>` | Move to child component |
| Promise created inside `use()` consumer | Create in parent, pass as prop |
| Module scope `new QueryClient()` in SSR | `useState(() => new QueryClient())` |
| `navigate()` for auth error recovery | `window.location.href` (hard nav) |
| Lazy loading without Suspense boundary | Always wrap `lazy()` in `<Suspense>` |
| Compartment ref shared across instances | `useRef(new Compartment())` per component |
| `toHaveBeenCalledWith` on mutations | `mock.mock.calls[0][0]` (v5 context arg) |
| `fireEvent` for user interactions | `userEvent` (simulates real interactions) |
| `getByTestId` on interactive elements | `getByRole`, `getByLabelText` |
| Missing `cursor-pointer` on clickable elements | Add to all buttons, links, selects |
| Boolean toggle in URL state | `useSearchParamState` with `replaceState` |
| `console.log` left in production | Remove before merge |
| `localStorage` for auth in SSR | Use cookies (available in both SSR and client) |
| `+guard.client.ts` in SSR mode | Use `+guard.ts` (runs on both server and client) |
| `export default` on guard/data | Must be named export: `export function guard()` |
| `vi.mock` after the import that uses it | Put `vi.mock` before the import |
| `vi.mocked()` on axios | Use `as Mock` type cast instead |
| RTL DOM leaking between tests | Add explicit `cleanup()` in `beforeEach` |
| jsdom `max-age=0` not deleting cookies | Clear cookies manually in `beforeEach` |


---

---
name: python-fastapi-patterns
description: Deep reference for Python/FastAPI patterns -- async SQLAlchemy, Pydantic v2, service layer, dependency injection, error handling, testing, background jobs. Covers non-obvious gotchas and production patterns.
---

# Python / FastAPI / SQLAlchemy Patterns

Production patterns for FastAPI applications with async SQLAlchemy 2.0 and Pydantic v2. Focused on things that are non-obvious or that people commonly get wrong.

---

## Table of Contents

1. [Dependency Injection](#dependency-injection)
2. [Async SQLAlchemy Session Management](#async-sqlalchemy-session-management)
3. [SQLAlchemy ORM Patterns](#sqlalchemy-orm-patterns)
4. [Pydantic v2 Patterns](#pydantic-v2-patterns)
5. [Service Layer Architecture](#service-layer-architecture)
6. [Error Handling](#error-handling)
7. [Authentication & Authorization](#authentication--authorization)
8. [Pagination](#pagination)
9. [Background Jobs](#background-jobs)
10. [Testing](#testing)
11. [Database Migrations](#database-migrations)
12. [Configuration](#configuration)
13. [Concurrency & Locking](#concurrency--locking)
14. [Quick Reference](#quick-reference)

---

## Dependency Injection

### Extract Ownership Checks into Dependencies

Every route that accesses a user-owned resource repeats the same lookup + ownership check. Extract it.

```python
# BAD: Duplicated in every route
@router.get("/decks/{deck_id}")
async def get_deck(
    deck_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deck = await repo.get_by_id(deck_id)
    if not deck or deck.user_id != user.id:
        raise NotFoundError("Deck")
    return deck

@router.put("/decks/{deck_id}")
async def update_deck(
    deck_id: UUID,
    body: DeckUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deck = await repo.get_by_id(deck_id)
    if not deck or deck.user_id != user.id:
        raise NotFoundError("Deck")  # same check, again
    ...

# GOOD: Reusable dependency
async def get_owned_deck(
    deck_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Deck:
    repo = DeckRepository(db)
    deck = await repo.get_by_id(deck_id)
    if not deck or deck.user_id != user.id:
        raise NotFoundError("Deck")
    return deck

@router.get("/decks/{deck_id}")
async def get_deck(deck: Deck = Depends(get_owned_deck)):
    return deck

@router.put("/decks/{deck_id}")
async def update_deck(body: DeckUpdate, deck: Deck = Depends(get_owned_deck)):
    ...
```

FastAPI caches dependency results within a single request. If `get_current_user` is used by multiple chained dependencies, it only runs once.

### Use Annotated Types for Cleaner Signatures

```python
from typing import Annotated

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

# Before
@router.get("/decks")
async def list_decks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(),
): ...

# After
@router.get("/decks")
async def list_decks(
    user: CurrentUser,
    db: DbSession,
    pagination: PaginationParams = Depends(),
): ...
```

### Router-Level Dependencies Over Middleware

```python
# BAD: Auth middleware with fragile whitelist
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    public_routes = ["/", "/login", "/health"]
    if request.url.path not in public_routes:
        # Verify token... easy to forget adding new public routes
        ...
    return await call_next(request)

# GOOD: Router-level protection is structural
protected = APIRouter(dependencies=[Depends(get_current_user)])
public = APIRouter()

app.include_router(protected, prefix="/api")
app.include_router(public)

# Every route on `protected` is automatically auth-gated
# New public routes go on `public` -- impossible to forget
```

### When NOT to Use Depends

```python
# WRONG: Wrapping pure computation in Depends
async def calculate_tax(amount: float) -> float:
    return amount * 0.1

@router.post("/order")
async def create_order(tax: float = Depends(calculate_tax)): ...

# RIGHT: Depends is for request-scoped resources (DB, auth, config)
@router.post("/order")
async def create_order(amount: float, db: DbSession):
    tax = amount * 0.1  # just call it
```

Use `Depends` for: database sessions, auth, rate limiters, request-scoped config.
Don't use `Depends` for: pure functions, one-off logic, values you'd cache with `@lru_cache`.

---

## Async SQLAlchemy Session Management

### expire_on_commit=False Is Mandatory for Async

This is the single most common source of production crashes with async SQLAlchemy.

```python
# BAD: Default expire_on_commit=True
async_session_factory = async_sessionmaker(engine, class_=AsyncSession)
# After commit(), all attributes expire. Accessing them triggers
# a SYNCHRONOUS lazy reload, which raises MissingGreenlet in async context.

# GOOD: Disable expiry after commit
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # CRITICAL
)
```

### Eager Loading Is Not Optional

In sync SQLAlchemy, lazy loading "just works" -- it fires a query when you access a relationship. In async, lazy loading is a synchronous I/O call that crashes.

```python
# BAD: Lazy loading in async context
async def get_deck_with_problems(db: AsyncSession, deck_id: UUID) -> Deck:
    result = await db.execute(select(Deck).where(Deck.id == deck_id))
    deck = result.scalar_one()
    problems = deck.problems  # CRASH: MissingGreenlet
    return deck

# GOOD: Explicit eager loading
from sqlalchemy.orm import selectinload, joinedload

async def get_deck_with_problems(db: AsyncSession, deck_id: UUID) -> Deck:
    result = await db.execute(
        select(Deck)
        .where(Deck.id == deck_id)
        .options(selectinload(Deck.problems))
    )
    return result.scalar_one()
```

**Which eager loading strategy to use:**

| Strategy | Best for | How it works |
|----------|----------|-------------|
| `selectinload` | One-to-many collections | Separate `SELECT ... WHERE id IN (...)` query. Default choice. |
| `joinedload` | Many-to-one, one-to-one | Uses JOIN. Avoid for collections (creates cartesian product). |
| `subqueryload` | Large one-to-many | Subquery instead of IN clause. Use when selectinload generates too many params. |

### Use lazy="raise" to Catch Mistakes Early

```python
class Deck(Base):
    __tablename__ = "decks"
    problems: Mapped[list["Problem"]] = relationship(lazy="raise")
    # Now any accidental lazy load raises immediately in dev
    # instead of silently crashing in production
```

### Never Share a Session Across Concurrent Tasks

```python
# BAD: Same session in asyncio.gather -- race condition
session = async_session_factory()
await asyncio.gather(
    service_a.do_work(session),
    service_b.do_work(session),  # NOT thread/task safe
)

# GOOD: One session per concurrent task
async def fetch_one(uid: UUID) -> User:
    async with async_session_factory() as db:
        return await db.get(User, uid)

results = await asyncio.gather(*[fetch_one(uid) for uid in ids])
```

### Session-per-Request Transaction Boundary

```python
# The correct pattern: dependency manages transaction lifecycle
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# Services use flush() -- NOT commit()
# flush() sends SQL to the database within the transaction
# commit() happens once at the request boundary via get_db
class BaseRepository:
    async def create(self, data, **extra) -> ModelT:
        obj = self.model(**data.model_dump(), **extra)
        self.db.add(obj)
        await self.db.flush()      # sends INSERT, gets generated ID
        await self.db.refresh(obj) # loads server defaults (created_at, etc.)
        return obj
```

**Why flush, not commit, in services:** If a request calls two services and the second one fails, the entire transaction rolls back -- including the first service's work. If the first service had called `commit()`, its work is already permanent and you have an inconsistent state.

### Detached Instance Gotcha After Session Close

```python
# Without expire_on_commit=False, this crashes:
async def get_user(db: AsyncSession, user_id: UUID) -> User:
    user = await db.get(User, user_id)
    await db.commit()
    return user  # user.email triggers lazy reload -- CRASH

# With expire_on_commit=False, attributes stay loaded after commit
# This is why the setting is critical
```

---

## SQLAlchemy ORM Patterns

### Modern Mapped Syntax (2.0+)

```python
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase
from sqlalchemy import String, DateTime, func
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

### Postgres Enum Helper

Python enums and Postgres enums have a case mismatch. Python uses `UPPERCASE` by default, Postgres expects `lowercase`.

```python
import enum
from sqlalchemy import Enum

class Difficulty(enum.StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

def pg_enum(enum_class: type[enum.StrEnum], name: str) -> Enum:
    """Create SQLAlchemy Enum with lowercase values for Postgres."""
    return Enum(
        enum_class,
        name=name,
        values_callable=lambda e: [x.value for x in e],
    )

# Usage in model
class Problem(TimestampMixin, Base):
    __tablename__ = "problems"
    difficulty: Mapped[Difficulty] = mapped_column(
        pg_enum(Difficulty, "difficulty"), default=Difficulty.MEDIUM
    )
```

### Explicit Column Selection for Lists

TEXT columns live in PostgreSQL's TOAST tables and are expensive to retrieve in bulk.

```python
# BAD: select(Problem) loads ALL columns including 5 TEXT fields
result = await db.execute(select(Problem).where(Problem.user_id == user_id))

# GOOD: select only what the list view needs
_LIST_COLUMNS = [
    Problem.id, Problem.title, Problem.slug,
    Problem.difficulty, Problem.language, Problem.tags,
    Problem.created_at,
]
result = await db.execute(select(*_LIST_COLUMNS).where(Problem.user_id == user_id))
```

### Bulk Updates with CASE WHEN

Single SQL statement for multi-row updates. More efficient than a loop.

```python
from sqlalchemy import case, update

async def reorder_items(
    db: AsyncSession, parent_id: UUID, ordered_ids: list[UUID]
) -> None:
    whens = {item_id: idx for idx, item_id in enumerate(ordered_ids)}
    stmt = (
        update(DeckProblem)
        .where(DeckProblem.deck_id == parent_id)
        .values(position=case(whens, value=DeckProblem.problem_id))
    )
    await db.execute(stmt)
    await db.flush()
```

### Row-Level Locking for Concurrent Safety

```python
async def add_item_to_deck(
    db: AsyncSession, deck_id: UUID, problem_id: UUID
) -> DeckProblem:
    # Lock the parent row to prevent concurrent position races
    await db.execute(
        select(Deck).where(Deck.id == deck_id).with_for_update()
    )

    # Now safe to read max position and increment
    max_pos = await db.execute(
        select(func.coalesce(func.max(DeckProblem.position), -1) + 1)
        .where(DeckProblem.deck_id == deck_id)
    )
    next_position = max_pos.scalar_one()

    item = DeckProblem(
        deck_id=deck_id,
        problem_id=problem_id,
        position=next_position,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item
```

### JSONB for Semi-Structured Data

```python
from sqlalchemy.dialects.postgresql import JSONB

class User(TimestampMixin, Base):
    __tablename__ = "users"
    ai_model_preferences: Mapped[dict[str, str] | None] = mapped_column(
        JSONB, nullable=True, default=None
    )

# Query JSONB fields
stmt = select(User).where(
    User.ai_model_preferences["default_model"].as_string() == "claude-sonnet"
)
```

---

## Pydantic v2 Patterns

### Separate Create/Update/Read Schemas

```python
# Create: required fields with defaults
class DeckCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""

# Update: all fields optional (partial update)
class DeckUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None

# Read: full response shape
class DeckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    description: str
    created_at: datetime
    updated_at: datetime

# List item: lightweight (no expensive fields)
class DeckListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    problem_count: int
    created_at: datetime
```

### Partial Updates with exclude_unset

```python
async def update(self, id: UUID, data: UpdateSchemaT) -> ModelT:
    obj = await self.get_by_id_or_raise(id)
    # Only update fields the client actually sent
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(obj, field, value)
    await self.db.flush()
    await self.db.refresh(obj)
    return obj
```

**Why `exclude_unset`:** Without it, `DeckUpdate(title="New")` would also set `description=None`, wiping the existing description. With `exclude_unset=True`, only `title` is included in the update dict.

### field_validator Ordering Trap

Validators only see fields defined BEFORE them in the class.

```python
class UserCreate(BaseModel):
    password: str
    password_confirm: str  # defined AFTER password

    @field_validator("password_confirm")
    @classmethod
    def passwords_match(cls, v: str, info: ValidationInfo) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords don't match")
        return v
        # Works because "password" is defined before "password_confirm"
        # If you swap the field order, info.data["password"] won't exist
```

### model_validator for Cross-Field Validation

```python
class DateRange(BaseModel):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def end_after_start(self) -> "DateRange":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date")
        return self
```

### model_validator(mode="before") for Input Normalization

```python
class ProblemCreate(BaseModel):
    tags: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def normalize_tags(cls, data: Any) -> Any:
        # Accept comma-separated string or list
        if isinstance(data, dict) and isinstance(data.get("tags"), str):
            data["tags"] = [t.strip() for t in data["tags"].split(",") if t.strip()]
        return data
```

### Reusable Validators with Annotated

```python
from typing import Annotated
from pydantic import AfterValidator

def validate_slug(v: str) -> str:
    if not v.replace("-", "").isalnum():
        raise ValueError("Slug must be alphanumeric with hyphens")
    return v.lower()

Slug = Annotated[str, AfterValidator(validate_slug)]

# Reuse across models -- zero duplication
class DeckCreate(BaseModel):
    slug: Slug

class ProblemCreate(BaseModel):
    slug: Slug
```

### computed_field for Derived Data

```python
from pydantic import computed_field

class DeckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slot_count: int
    filled_slot_count: int

    @computed_field
    @property
    def completion_percentage(self) -> float:
        if self.slot_count == 0:
            return 0.0
        return round(self.filled_slot_count / self.slot_count * 100, 1)
```

### Default Values Are Not Validated

```python
class Config(BaseModel):
    retries: int = -1  # This passes -- default is NOT validated!

    @field_validator("retries")
    @classmethod
    def check_positive(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Must be positive")
        return v

# Config()  -- NO error! Default -1 slips through.
# Fix: add validate_default=True
class Config(BaseModel):
    model_config = ConfigDict(validate_default=True)
    retries: int = -1  # Now this IS validated and raises
```

### Subclass Serialization Trap

```python
class Animal(BaseModel):
    name: str

class Dog(Animal):
    breed: str

class Zoo(BaseModel):
    animal: Animal

zoo = Zoo(animal=Dog(name="Rex", breed="Lab"))
zoo.model_dump()
# {"animal": {"name": "Rex"}}  -- breed is GONE!
# Pydantic serializes to the declared type (Animal), not the runtime type (Dog)

# Fix: use SerializeAsAny
from pydantic import SerializeAsAny

class Zoo(BaseModel):
    animal: SerializeAsAny[Animal]
# Now: {"animal": {"name": "Rex", "breed": "Lab"}}
```

---

## Service Layer Architecture

### Decision Hierarchy

```
Route (thin controller)
  → validates input (Pydantic)
  → delegates to service
  → returns response

Service (business logic)
  → domain rules
  → orchestrates repositories
  → raises domain exceptions

Repository (data access)
  → SQL queries
  → flush/refresh
  → no business logic
```

### Services Must Not Know About HTTP

```python
# BAD: Service raises HTTPException
from fastapi import HTTPException

class DeckService:
    async def get_deck(self, deck_id: UUID) -> Deck:
        deck = await self.repo.get_by_id(deck_id)
        if not deck:
            raise HTTPException(status_code=404)  # HTTP leak!
        return deck

# GOOD: Service raises domain exception
from app.utils.exceptions import NotFoundError

class DeckService:
    async def get_deck(self, deck_id: UUID) -> Deck:
        deck = await self.repo.get_by_id(deck_id)
        if not deck:
            raise NotFoundError("Deck")  # domain exception
        return deck

# The translation happens once, globally:
@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": type(exc).__name__, "message": exc.message}},
    )
```

### Services Must Not Own the Session

```python
# BAD: Service creates its own session
class DeckService:
    async def create_deck(self, data: DeckCreate) -> Deck:
        async with async_session_factory() as db:
            deck = Deck(**data.model_dump())
            db.add(deck)
            await db.commit()  # commits immediately -- can't compose
            return deck

# GOOD: Session injected from outside
class DeckRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: DeckCreate, **extra) -> Deck:
        deck = Deck(**data.model_dump(), **extra)
        self.db.add(deck)
        await self.db.flush()  # within transaction, doesn't commit
        await self.db.refresh(deck)
        return deck

# Multiple repos in one request share the same session + transaction
@router.post("/clone")
async def clone_problem(body: CloneRequest, db: DbSession, user: CurrentUser):
    problem_repo = ProblemRepository(db)
    viz_repo = VisualizationRepository(db)
    # Both repos operate within the same transaction
    # If viz cloning fails, problem creation is rolled back too
    problem = await problem_repo.create(...)
    await viz_repo.clone_for_problem(original_id, problem.id)
    return problem
```

### When NOT to Use a Service

Don't wrap a single ActiveRecord/ORM call in a service just for architecture's sake.

```python
# OVER-ENGINEERED: Service adds nothing
class UserService:
    async def get_user(self, user_id: UUID) -> User:
        return await self.repo.get_by_id(user_id)

# FINE: Simple lookup directly in route
@router.get("/users/{user_id}")
async def get_user(user_id: UUID, db: DbSession) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User")
    return user
```

Use a service when:
- There's business logic beyond CRUD
- Multiple repositories need to coordinate
- The operation has side effects (emails, webhooks, analytics)
- The logic needs to be tested independently of HTTP

### Cross-Service Operations

```python
# Services that need each other should share the same session
class CommunityService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.problem_repo = ProblemRepository(db)
        self.viz_repo = VisualizationRepository(db)

    async def clone_problem(self, problem_id: UUID, user_id: UUID) -> Problem:
        original = await self.problem_repo.get_by_id_or_raise(problem_id)
        cloned = await self.problem_repo.create(...)
        await self.viz_repo.clone_for_problem(original.id, cloned.id)
        return cloned
        # Both operations in same transaction -- atomic
```

---

## Error Handling

### Exception Hierarchy

```python
class AppError(Exception):
    """Base exception for all domain errors."""
    def __init__(self, message: str = "An error occurred", status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class NotFoundError(AppError):
    def __init__(self, resource: str = "Resource"):
        super().__init__(f"{resource} not found", status_code=404)

class AuthenticationError(AppError):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)

class AuthorizationError(AppError):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, status_code=403)

class ValidationError(AppError):
    def __init__(self, message: str = "Validation failed"):
        super().__init__(message, status_code=400)

class ConflictError(AppError):
    def __init__(self, message: str = "Conflict"):
        super().__init__(message, status_code=409)

class ExternalServiceError(AppError):
    def __init__(self, service: str, message: str = ""):
        super().__init__(f"{service} error: {message}", status_code=502)
```

### Global Exception Handlers

```python
def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": type(exc).__name__, "message": exc.message}},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Stringify non-serializable context values
        safe_errors = []
        for err in exc.errors():
            safe_err = {**err}
            if "ctx" in safe_err:
                safe_err["ctx"] = {k: str(v) for k, v in safe_err["ctx"].items()}
            safe_errors.append(safe_err)
        return JSONResponse(
            status_code=422,
            content={"error": {
                "code": "ValidationError",
                "message": "Request validation failed",
                "detail": safe_errors,
            }},
        )

    @app.exception_handler(Exception)
    async def handle_unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled_exception", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "InternalServerError", "message": "Internal server error"}},
        )
```

### HTTPException in Middleware Does NOT Hit Exception Handlers

```python
# WRONG: This HTTPException won't be caught by @app.exception_handler
@app.middleware("http")
async def my_middleware(request: Request, call_next):
    raise HTTPException(status_code=401)  # NOT caught by handlers!

# The middleware stack is:
#   ServerErrorMiddleware -> Custom Middleware -> ExceptionMiddleware -> Router
# Exception handlers live in ExceptionMiddleware, but custom middleware sits ABOVE it.

# RIGHT: Return JSONResponse directly in middleware
@app.middleware("http")
async def my_middleware(request: Request, call_next):
    return JSONResponse(
        status_code=401,
        content={"error": {"code": "Unauthorized", "message": "..."}},
    )
```

### Consistent Error Envelope

Every error response follows the same shape:

```json
{
  "error": {
    "code": "NotFoundError",
    "message": "Deck not found",
    "detail": null
  }
}
```

This includes Pydantic validation errors, domain errors, and unhandled exceptions. The frontend always checks `response.error.message` -- never different shapes for different error types.

---

## Authentication & Authorization

### Dependencies Over Middleware for Auth

```python
# Auth dependency -- the canonical FastAPI pattern
bearer_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token")

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise AuthenticationError("User not found or inactive")
    return user
```

**Why dependencies, not middleware:**
1. Type-safe: returns `User`, not `request.state.user`
2. Only runs on routes that need it (no whitelist)
3. Composes: `require_role` chains on `get_current_user`
4. FastAPI caches per request (multiple deps calling `get_current_user` resolve it once)

### Parameterized Role Dependencies

```python
def require_role(*roles: UserRole) -> Callable[..., Awaitable[User]]:
    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise AuthorizationError("Insufficient permissions")
        return user
    return checker

# Usage
@router.delete("/users/{user_id}")
async def delete_user(user: User = Depends(require_role(UserRole.ADMIN))):
    ...
```

### JWT Token Pair Pattern

```python
def create_access_token(user_id: UUID) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=30)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")

def create_refresh_token(user_id: UUID) -> str:
    expire = datetime.now(UTC) + timedelta(days=7)
    payload = {"sub": str(user_id), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired")
    except jwt.PyJWTError:
        raise AuthenticationError("Invalid token")
```

**Important: Token type validation.** Always check `payload["type"]` matches the expected type. Without this, a refresh token can be used as an access token.

---

## Pagination

### Offset-Limit with Dependency

```python
from fastapi import Query

class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=250),
    ):
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    limit: int
    has_more: bool

    @classmethod
    def create(cls, *, items: list, total: int, page: int, limit: int):
        return cls(
            items=items, total=total, page=page, limit=limit,
            has_more=(page * limit) < total,
        )
```

### When to Consider Cursor-Based Pagination

Offset pagination is O(n) for deep pages (`OFFSET 10000` scans and discards 10,000 rows).

Consider cursor-based pagination when:
- Users can scroll through 1,000+ items
- You have an activity feed or timeline
- Response time degrades noticeably on page 50+

```python
# Cursor-based: WHERE (created_at, id) < (cursor_values) ORDER BY created_at DESC, id DESC
# Constant time regardless of page depth
# But: no random page access, no total count
```

For most apps (decks, problem lists, admin tables), offset pagination is fine.

---

## Background Jobs

### Decision Matrix

| Criteria | `BackgroundTasks` | `arq` / `SAQ` | Celery |
|----------|-------------------|---------------|--------|
| Survives server crash | No | Yes (Redis) | Yes |
| Retry with backoff | No | Yes | Yes |
| Status tracking | No | Yes | Yes |
| Separate process | No | Yes | Yes |
| Setup complexity | None | Low | High |
| Best for | Fire-and-forget (emails, logging) | Async I/O (LLM calls, webhooks) | CPU-heavy, distributed |

### When to Use BackgroundTasks

```python
@router.post("/users", status_code=201)
async def create_user(data: UserCreate, background_tasks: BackgroundTasks):
    user = await service.create(data)
    # Fire-and-forget: if email fails, user is still created
    background_tasks.add_task(send_welcome_email, user.email)
    return user
```

### When to Use a Job Queue

```python
# Long-running, needs retry, needs status tracking
@router.post("/visualizations/generate")
async def generate_viz(data: GenerateRequest, user: CurrentUser):
    job = await redis_pool.enqueue_job(
        "generate_visualization",
        data.model_dump(),
        _job_id=f"viz-{user.id}-{uuid4()}",
    )
    return {"job_id": job.job_id, "status": "queued"}
```

### Idempotent Job Design

```python
# BAD: Not idempotent -- retries create duplicates
async def process_payment(ctx, order_id: str):
    order = await get_order(order_id)
    await charge_card(order.amount)  # retried = double charge!
    order.status = "paid"
    await save(order)

# GOOD: Check-before-act pattern
async def process_payment(ctx, order_id: str):
    order = await get_order(order_id)
    if order.status == "paid":
        return  # already processed, skip
    await charge_card(order.amount, idempotency_key=order_id)
    order.status = "paid"
    await save(order)
```

---

## Testing

### Test Database Setup

```python
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/myapp_test"

# NullPool: no connection pooling in tests -- prevents leaks between tests
test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
test_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

@pytest.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

### Dependency Override for Tests

```python
@pytest.fixture
async def client():
    async def override_get_db():
        async with test_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()  # ALWAYS clean up
```

### Test Fixture Pattern

```python
@pytest.fixture
async def test_user(db: AsyncSession) -> User:
    user = User(
        id=uuid4(),
        email="test@example.com",
        github_id="12345",
        github_username="testuser",
        role=UserRole.USER,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@pytest.fixture
async def auth_headers(test_user: User) -> dict:
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}
```

### Unit Tests: Mock the Session, Not the Service

```python
# Test business logic without touching HTTP or database
@pytest.mark.asyncio
async def test_deck_service_rejects_duplicate_problem():
    mock_db = AsyncMock(spec=AsyncSession)
    # Simulate existing deck_problem
    mock_db.execute.return_value = MagicMock(
        scalar_one_or_none=MagicMock(return_value=existing_deck_problem)
    )

    with pytest.raises(ConflictError, match="already in deck"):
        await add_problem_to_deck(mock_db, deck_id, problem_id)
```

### Integration Tests: Hit the Real Stack

```python
@pytest.mark.asyncio
async def test_create_deck(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/decks",
        json={"title": "Arrays", "description": "Array problems"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Arrays"
    assert "id" in data
```

### Test Error Paths, Not Just Happy Paths

```python
@pytest.mark.asyncio
async def test_get_deck_not_found(client: AsyncClient, auth_headers: dict):
    response = await client.get(f"/api/decks/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NotFoundError"

@pytest.mark.asyncio
async def test_create_deck_unauthorized(client: AsyncClient):
    response = await client.post("/api/decks", json={"title": "Test"})
    assert response.status_code == 403  # No auth header
```

---

## Database Migrations

### Review Autogenerated Migrations

Alembic autogenerate produces false positives:
- Dropping and recreating indexes that haven't changed
- Reordering columns
- Recreating enum types

**Always read every migration before running it.** Delete the noise.

### Enum Types: Always Raw SQL

```python
# BAD: sa.Enum.create() in migration
def upgrade():
    sa.Enum("easy", "medium", "hard", name="difficulty").create(op.get_bind())

# GOOD: Raw SQL with existence check (idempotent)
def upgrade():
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty')
            THEN CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
            END IF;
        END $$
    """)
```

### Adding Values to an Existing Enum

```python
# PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE until v12
# Use this pattern:
def upgrade():
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'ruby'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'language')
            ) THEN
                ALTER TYPE language ADD VALUE 'ruby';
            END IF;
        END $$
    """)
```

### Never Hardcode Revision IDs

Let Alembic generate unique revision IDs. Copying from examples or other migrations causes conflicts.

```bash
# ALWAYS generate fresh
alembic revision --autogenerate -m "add language column"
# Never copy revision = "abc123" from another file
```

### Test Migrations Both Ways

1. Against a clean database (from scratch)
2. Against current production state (incremental)

A migration that works from scratch but fails on production data (or vice versa) will bite you on deploy.

---

## Configuration

### Pydantic BaseSettings with Production Validation

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

_WEAK_SECRET = "dev-secret-change-me"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env",),
        case_sensitive=False,
    )

    # App
    debug: bool = False
    cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://localhost/myapp"

    # Auth
    secret_key: str = _WEAK_SECRET
    access_token_expire_minutes: int = 30

    # Pool
    db_pool_size: int = 5
    db_pool_recycle: int = 1800  # 30 min

    @model_validator(mode="after")
    def enforce_production(self) -> "Settings":
        if not self.debug and self.secret_key == _WEAK_SECRET:
            raise ValueError("SECRET_KEY must be set in production")
        # Auto-convert Render's postgresql:// to asyncpg
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

settings = Settings()
```

### Engine Configuration for PaaS

```python
engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,        # verify connections before use
    pool_size=5,                # match your plan's connection limit
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=1800,          # recycle connections every 30 min
    connect_args={
        "server_settings": {"statement_timeout": "30000"}  # 30s query timeout
    },
)
```

---

## Concurrency & Locking

### with_for_update() for Serialized Access

See [Row-Level Locking](#row-level-locking-for-concurrent-safety) above.

Use when:
- Multiple requests can modify the same parent (e.g., adding items to a deck)
- Position/ordering needs to be sequential
- You need to read-then-write atomically

Don't use when:
- Reads only (no locking needed)
- Low contention (personal projects with single-user access)

### Atomic Counter Updates

```python
# BAD: Read-modify-write race condition
problem = await db.get(Problem, problem_id)
problem.clone_count += 1  # another request could read the old value

# GOOD: Atomic increment in SQL
from sqlalchemy import update

stmt = (
    update(Problem)
    .where(Problem.id == problem_id)
    .values(clone_count=Problem.clone_count + 1)
)
await db.execute(stmt)
```

---

## Quick Reference

| Mistake | Fix |
|---------|-----|
| `expire_on_commit=True` (default) | Set `expire_on_commit=False` on async sessionmaker |
| Lazy loading relationships in async | Use `selectinload`/`joinedload` explicitly |
| `commit()` inside service methods | Use `flush()` in services, `commit()` at request boundary |
| `HTTPException` in services | Raise domain exceptions (`NotFoundError`, etc.) |
| `SELECT *` on list endpoints | Select specific columns, exclude TEXT fields |
| `ORDER BY random()` for queues | Pre-compute priority, or use offset-based sampling |
| Hardcoded enum creation in migrations | Raw SQL with `IF NOT EXISTS` |
| `sa.Enum.create()` in Alembic | Raw SQL always |
| `any` in Pydantic field types | Use `unknown` patterns or specific union types |
| Default values not validated | Set `validate_default=True` in `model_config` |
| Session shared across `asyncio.gather` | One session per concurrent task |
| `HTTPException` in middleware | Return `JSONResponse` directly |
| Mutable default arguments | Use `Field(default_factory=list)` not `Field(default=[])` |
| Route handles business logic | Extract to service layer |
| Missing error path tests | Test 404, 401, 403, 422 alongside happy paths |


---

---
name: database-patterns
description: Deep reference for PostgreSQL schema design, query optimization, indexing, migration safety, and data modeling. Focused on patterns that prevent costly refactors.
---

# Database Patterns

Production patterns for PostgreSQL schema design, query optimization, and migration discipline. These patterns apply regardless of your ORM (SQLAlchemy, ActiveRecord, Prisma, raw SQL).

---

## Table of Contents

1. [Schema Design Principles](#schema-design-principles)
2. [Data Modeling Decisions](#data-modeling-decisions)
3. [Indexing Strategy](#indexing-strategy)
4. [Query Optimization](#query-optimization)
5. [Migration Safety](#migration-safety)
6. [Enum Patterns](#enum-patterns)
7. [Soft Delete](#soft-delete)
8. [Audit Logging](#audit-logging)
9. [Connection Management](#connection-management)
10. [Quick Reference](#quick-reference)

---

## Schema Design Principles

### One Concern Per Table

If a table serves two masters, the queries for both get slower and the code gets tangled.

**Smell:** Groups of columns that always get updated together but independently from other groups.

```
-- BAD: Problem table mixing content and review state
problems
├── id, title, slug, description        -- content (read often, updated rarely)
├── solution_code, starter_code         -- content (large TEXT, updated rarely)
├── ease_factor, review_interval        -- review state (updated every practice)
├── repetitions, next_review_at         -- review state
└── review_uncertainty                  -- review state

-- Every list query carries review state it doesn't need
-- Every review query carries content columns it doesn't need
```

```
-- GOOD: Separate concerns
problems
├── id, title, slug, description, solution_code, starter_code

problem_review_states
├── problem_id (FK), ease_factor, review_interval, repetitions, next_review_at
```

**When to split:** When you feel the pain, not before. Two instances of awkward queries is a coincidence. Three is a pattern worth extracting.

### Domain Names, Not UI Names

Column names describe what the data IS, not how it's DISPLAYED.

```
Good:  title, scheduled_at, status, difficulty, position
Bad:   card_title, calendar_display_date, sidebar_status, dropdown_difficulty
```

**Test:** If you rename a UI element, would you need to rename a column? If yes, the column name leaks presentation.

### Status Enums, Not Boolean Soup

```sql
-- BAD: Boolean soup creates impossible states
ALTER TABLE jobs ADD COLUMN is_quoted BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN is_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN is_in_progress BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN is_paid BOOLEAN DEFAULT FALSE;
-- Q: What does is_completed = true AND is_in_progress = true mean?

-- GOOD: One column, defined states
CREATE TYPE job_status AS ENUM ('lead', 'quoted', 'accepted', 'in_progress', 'completed', 'paid');
ALTER TABLE jobs ADD COLUMN status job_status NOT NULL DEFAULT 'lead';
-- Impossible to be completed AND in_progress simultaneously
```

### Timestamps on Everything

```sql
-- Mutable tables: both timestamps
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- Append-only audit tables: only created_at (they never change)
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- No updated_at -- audit records are immutable
```

### Nullable Foreign Keys for Optional Relationships

When a relationship is optional (e.g., a visualization MAY be linked to a problem):

```sql
-- Use nullable FK with SET NULL on delete
problem_id UUID REFERENCES problems(id) ON DELETE SET NULL
-- If the problem is deleted, the visualization keeps its other data
```

Cleaner than a join table for 0-or-1 relationships.

---

## Data Modeling Decisions

### UUID vs Integer Primary Keys

| | UUID | Integer |
|---|---|---|
| Globally unique | Yes | No |
| Client-side generation | Yes | No (needs DB roundtrip) |
| URL guessability | Low | High (enumerable) |
| Index size | 16 bytes | 4-8 bytes |
| Sort by creation order | No (use timestamp) | Yes (auto-increment) |

**Use UUIDs when:** User-facing IDs, distributed systems, API resources.
**Use integers when:** Internal join tables, high-volume analytics tables where index size matters.

### Join Table Design

```sql
-- Many-to-many with metadata
CREATE TABLE deck_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    section VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (deck_id, problem_id)  -- prevent duplicate membership
);

-- Index the foreign keys (PostgreSQL does NOT auto-index them)
CREATE INDEX idx_deck_problems_deck_id ON deck_problems(deck_id);
CREATE INDEX idx_deck_problems_problem_id ON deck_problems(problem_id);
```

### Partial Unique Indexes

When uniqueness only applies to a subset of rows:

```sql
-- Allow multiple empty slots per deck, but each problem can only appear once
CREATE UNIQUE INDEX uq_deck_slot_problem
    ON deck_slots(deck_id, problem_id)
    WHERE problem_id IS NOT NULL;
-- NULL values don't violate unique constraints in PostgreSQL
-- This prevents assigning the same problem to two slots in one deck
```

### JSONB for Semi-Structured Data

Use JSONB when the schema varies per row or changes frequently.

```sql
-- User preferences: structure varies by feature flags, user type, etc.
ai_model_preferences JSONB DEFAULT NULL

-- Query JSONB in PostgreSQL
SELECT * FROM users WHERE ai_model_preferences->>'default_model' = 'claude-sonnet';

-- Index JSONB for query performance
CREATE INDEX idx_user_preferences ON users USING GIN (ai_model_preferences);
```

**Don't use JSONB for:** Data you query frequently with WHERE clauses. If you're filtering by `preferences->>'theme'` in every request, it should be a column.

### When to Denormalize

**Default:** Don't. JOINs are what relational databases are built for.

**Denormalize when:**
1. You've measured a performance problem (not assumed one)
2. The JOIN is the bottleneck (not missing indexes, not N+1 queries)
3. The denormalized data rarely changes (or you accept the update anomaly risk)

**Common acceptable denormalization:**
- `clone_count` on a problem (counter cache, updated atomically with SQL)
- `problem_count` on a deck (only if the JOIN to count is measurably slow)

**Always use atomic SQL for counter updates:**
```sql
-- NOT read-modify-write (race condition)
-- YES: atomic increment
UPDATE problems SET clone_count = clone_count + 1 WHERE id = $1;
```

---

## Indexing Strategy

### Index Your WHERE Clauses

Look at your actual queries and index what they filter on.

```sql
-- Query: "My active problems ordered by creation date"
SELECT * FROM problems
WHERE user_id = $1 AND is_archived = FALSE
ORDER BY created_at DESC;

-- Index:
CREATE INDEX idx_problems_user_active ON problems(user_id, created_at DESC)
WHERE is_archived = FALSE;
-- Partial index: only indexes non-archived rows, smaller and faster
```

### Composite Index Column Order Matters

The leftmost column is the entry point. Put the most selective column first.

```sql
-- Query filters on user_id AND status
CREATE INDEX idx_problems_user_status ON problems(user_id, status);
-- This index serves:
--   WHERE user_id = $1 AND status = 'active'  ✓
--   WHERE user_id = $1                         ✓ (leftmost prefix)
--   WHERE status = 'active'                    ✗ (can't skip user_id)
```

### PostgreSQL Does NOT Auto-Index Foreign Keys

Unlike MySQL, PostgreSQL does not automatically create indexes on foreign key columns. You must add them manually.

```sql
-- After creating a FK, always add the index
ALTER TABLE deck_problems ADD COLUMN deck_id UUID REFERENCES decks(id);
CREATE INDEX idx_deck_problems_deck_id ON deck_problems(deck_id);
-- Without this index, DELETE FROM decks WHERE id = $1
-- does a sequential scan on deck_problems
```

### Don't Index Everything

Each index:
- Slows down INSERTs and UPDATEs (index must be maintained)
- Uses disk space
- Adds write amplification

**Index when:** A query is slow and EXPLAIN shows a sequential scan on a large table.
**Don't index:** Columns only used in SELECT (not WHERE/JOIN/ORDER BY), small tables (<1000 rows), boolean columns with low selectivity.

### Use EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT * FROM problems
WHERE user_id = '...' AND is_archived = FALSE
ORDER BY created_at DESC
LIMIT 20;

-- Look for:
-- "Seq Scan" on large tables → needs an index
-- "Rows Removed by Filter: 50000" → index not selective enough
-- "Sort Method: external merge" → needs index on ORDER BY column
```

---

## Query Optimization

### Explicit Column Selection for Lists

TEXT columns live in PostgreSQL's TOAST tables. Fetching them in bulk is expensive.

```sql
-- BAD: Select everything including 5 TEXT columns
SELECT * FROM problems WHERE user_id = $1;

-- GOOD: Select only what the list view needs
SELECT id, title, slug, difficulty, language, tags, created_at
FROM problems WHERE user_id = $1;

-- Save the TEXT columns (description, solution_code, starter_code,
-- test_suite, editorial) for the detail view
```

### Don't Use ORDER BY random()

```sql
-- BAD: Full table scan, every single time
SELECT * FROM problems
WHERE next_review_at <= NOW()
ORDER BY random()
LIMIT 1;

-- BETTER: Random offset (two queries but index-friendly)
SELECT COUNT(*) FROM problems WHERE next_review_at <= NOW();
-- Then:
SELECT * FROM problems
WHERE next_review_at <= NOW()
OFFSET floor(random() * count)
LIMIT 1;

-- BEST: Pre-compute a review_priority column, index it
```

### N+1 Query Detection

The most common performance problem in ORM-based applications.

```python
# BAD: N+1 queries
decks = await db.execute(select(Deck).where(Deck.user_id == user_id))
for deck in decks:
    problems = deck.problems  # each access fires a query!

# GOOD: Eager load in one query
decks = await db.execute(
    select(Deck)
    .where(Deck.user_id == user_id)
    .options(selectinload(Deck.problems))
)
```

**In development, use `lazy="raise"` to catch N+1s immediately:**
```python
class Deck(Base):
    problems: Mapped[list[Problem]] = relationship(lazy="raise")
    # Accessing deck.problems without eager loading now raises instead of silently querying
```

### Aggregate Subqueries Over Separate Queries

```sql
-- BAD: One query for decks, then N queries for counts
SELECT * FROM decks WHERE user_id = $1;
-- For each deck: SELECT COUNT(*) FROM deck_problems WHERE deck_id = $deck_id;

-- GOOD: One query with subquery
SELECT d.*,
    COALESCE(pc.problem_count, 0) AS problem_count
FROM decks d
LEFT JOIN (
    SELECT deck_id, COUNT(*) AS problem_count
    FROM deck_problems
    GROUP BY deck_id
) pc ON d.id = pc.deck_id
WHERE d.user_id = $1;
```

---

## Migration Safety

### Never Use create_all() Outside Tests

`Base.metadata.create_all()` creates tables without the migration tool knowing. Next migration runs and hits `DuplicateObject` errors because the table already exists but has no migration record. Use `alembic upgrade head` (or `rails db:migrate`) for all non-test environments.

### Always Test Against Postgres, Never SQLite

SQLite silently ignores:
- Enum type constraints (any string passes)
- Row-level locking (`FOR UPDATE` is a no-op)
- Type mismatches (string in integer column works fine)
- Foreign key enforcement (off by default)

Your tests pass on SQLite and crash on Postgres. Use a real Postgres test database.

### Review Autogenerated Migrations

Migration generators produce false positives:
- Dropping and recreating indexes that haven't changed
- Reordering columns
- Recreating enum types
- Adding/removing indexes on unrelated tables

**Always read every migration before running it.** Delete the noise.

### Never Edit an Applied Migration

Once a migration has run (locally, in CI, or in prod), it is immutable. If you need to fix something, write a new migration on top. Editing an applied migration causes schema drift: the database ran the old version, the file now says something different, and `upgrade head` is a no-op because it thinks the migration already ran.

### Dangerous Operations: Lock Awareness

Some DDL operations lock the entire table. On a busy table, this means downtime.

```sql
-- LOCKS THE TABLE (blocks all reads and writes):
ALTER TABLE problems ADD COLUMN foo VARCHAR(255) NOT NULL DEFAULT 'bar';
-- On Postgres < 11, this rewrites the entire table

-- DOES NOT LOCK (on Postgres 11+):
ALTER TABLE problems ADD COLUMN foo VARCHAR(255) DEFAULT 'bar';
-- Nullable column with default is instant (metadata-only change)

-- SAFE pattern for NOT NULL with default:
-- Step 1: Add nullable column with default (instant)
ALTER TABLE problems ADD COLUMN foo VARCHAR(255) DEFAULT 'bar';
-- Step 2: Backfill existing rows (in batches, not one big UPDATE)
UPDATE problems SET foo = 'bar' WHERE foo IS NULL;
-- Step 3: Add NOT NULL constraint
ALTER TABLE problems ALTER COLUMN foo SET NOT NULL;
```

### Never Hardcode Revision IDs

Let your migration tool generate unique IDs. Copying from examples causes conflicts.

### Test Migrations: Round-Trip

```bash
alembic upgrade head     # apply
alembic downgrade -1     # test rollback
alembic upgrade head     # re-apply
pytest tests/ -v         # verify schema is correct
```

Test against:
1. A clean database (does CREATE TABLE work from scratch?)
2. Current production state (does ALTER TABLE apply cleanly?)

---

## Enum Patterns

### Always Raw SQL in Migrations

```python
# BAD: ORM-level enum creation
def upgrade():
    sa.Enum("easy", "medium", "hard", name="difficulty").create(op.get_bind())

# GOOD: Raw SQL with existence check (idempotent)
def upgrade():
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty')
            THEN CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
            END IF;
        END $$
    """)
```

### Adding Values to an Existing Enum

```sql
-- Check before adding (idempotent)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'ruby'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'language')
    ) THEN
        ALTER TYPE language ADD VALUE 'ruby';
    END IF;
END $$;
```

### Column Reference with create_type=False

When using enums in `create_table`:

```python
op.create_table(
    "problems",
    sa.Column("difficulty", sa.Enum("easy", "medium", "hard", name="difficulty", create_type=False)),
    # create_type=False: the enum already exists from the DO $$ block above
)
```

---

## Soft Delete

### deleted_at Over is_deleted

```sql
-- BAD: Boolean -- you only know IF, not WHEN
ALTER TABLE problems ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- GOOD: Timestamp -- you know IF and WHEN
ALTER TABLE problems ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
-- NULL = active, non-NULL = deleted at that timestamp
```

### Gotchas

1. **Every query must filter.** Miss one `WHERE deleted_at IS NULL` and you leak deleted data.
2. **Unique constraints break.** Soft-delete "two-sum" slug, create new "two-sum" -- unique violation. Fix: compound unique on `(slug, deleted_at)` or use a partial unique index.
3. **Cascade doesn't fire.** SQLAlchemy `cascade="all, delete"` only fires on hard deletes. Soft-deleted parents still have visible children.
4. **COUNT(*) includes deleted rows** unless filtered.

### Prefer Hard Delete Unless You Have a Reason

Soft delete adds complexity to every query. Only use it when you genuinely need:
- Undo/restore functionality
- Regulatory data retention
- Audit trail requirements

For most resources, hard delete is simpler and correct.

---

## Audit Logging

### Append-Only Audit Table

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(255) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL,  -- 'insert', 'update', 'delete'
    changes JSONB,                 -- {field: {old: x, new: y}}
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- NO updated_at: audit records are immutable
);

CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
```

### Write Audit Logs in the Same Transaction

```python
# Audit log is written in the same transaction as the data change.
# If the transaction rolls back, the audit log rolls back too.
# No phantom audit entries.

async def update_problem(db: AsyncSession, problem: Problem, data: ProblemUpdate):
    changes = {}
    update_data = data.model_dump(exclude_unset=True)
    for field, new_value in update_data.items():
        old_value = getattr(problem, field)
        if old_value != new_value:
            changes[field] = {"old": str(old_value), "new": str(new_value)}
            setattr(problem, field, new_value)

    if changes:
        db.add(AuditLog(
            table_name="problems",
            record_id=problem.id,
            action="update",
            changes=changes,
            user_id=problem.user_id,
        ))
    await db.flush()
```

---

## Connection Management

### Pool Configuration for PaaS

```python
engine = create_async_engine(
    database_url,
    pool_pre_ping=True,     # verify connections before use
    pool_size=5,             # match your plan's connection limit
    max_overflow=5,          # burst capacity
    pool_timeout=30,         # wait 30s for a connection before failing
    pool_recycle=1800,       # recycle connections every 30 min (prevent stale)
    connect_args={
        "server_settings": {"statement_timeout": "30000"}  # 30s query timeout
    },
)
```

**pool_pre_ping:** Sends a lightweight query before each connection use. Catches connections that were closed by the server (idle timeout, restart). Small overhead, prevents "connection closed" errors.

**pool_recycle:** PaaS platforms (Render, Heroku, Railway) kill idle connections. Recycling before the platform's timeout prevents "server closed the connection unexpectedly" errors.

**statement_timeout:** Prevents runaway queries from holding connections indefinitely. 30 seconds is reasonable for a web app.

### NullPool for Tests

```python
from sqlalchemy.pool import NullPool

test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
# No pooling = no connection leaks between tests
# Each test gets a fresh connection
```

---

## Quick Reference

| Mistake | Fix |
|---------|-----|
| Boolean soup (`is_active`, `is_completed`, `is_paid`) | Single status enum column |
| UI names in columns (`card_title`, `sidebar_label`) | Domain names (`title`, `label`) |
| `SELECT *` on list endpoints | Explicit column selection |
| Missing FK indexes | Always index foreign keys manually |
| `ORDER BY random()` | Offset-based sampling or priority column |
| `sa.Enum.create()` in migrations | Raw SQL with `IF NOT EXISTS` |
| Denormalizing "to avoid JOINs" | JOINs are fine; index the join columns |
| Soft delete by default | Hard delete unless you need undo/audit/regulatory |
| `NOT NULL DEFAULT 'x'` on large tables | Add nullable with default, backfill, then add NOT NULL |
| Counter cache with read-modify-write | Atomic SQL: `SET count = count + 1` |
| No `pool_pre_ping` | Stale connections crash on PaaS |
| No `statement_timeout` | Runaway queries hold connections forever |
| `create_all()` outside tests | Use migration tool (`alembic upgrade head`), never `create_all()` |
| Testing against SQLite | Always test against Postgres (SQLite ignores enums, locks, types) |
| Editing an applied migration | Write a new migration on top, never edit applied ones |
| Skipping round-trip test | Run upgrade, downgrade -1, upgrade again before deploying |

