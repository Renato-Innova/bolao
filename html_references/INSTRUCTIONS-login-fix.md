# Login Page Fix — No Scroll on Mobile

## Reference file
`html_references/m-01-login.html`

## What changed and why

The login page was showing a scrollbar on mobile because:
1. The container used `min-height: 100vh` — this allows the page to grow beyond the viewport
2. The footer text "FIFA World Cup 2026™ · EUA · Canadá · México" pushed content below the fold on small screens
3. `html` and `body` had no `overflow: hidden`

## Changes to apply in `src/app/auth/login/page.tsx`

### 1. Fix the outer wrapper
The outermost `<div>` must use `height: 100vh` (not `minHeight`) and must NOT have vertical padding that causes overflow.

Replace:
```
minHeight: '100vh',
padding: 24,
```

With:
```
height: '100vh',
padding: '0 16px',
overflow: 'hidden',
```

### 2. Remove the footer
Delete the last `<div>` that renders:
```
FIFA World Cup 2026™ · EUA · Canadá · México
```
It has no functional purpose and causes scroll on small screens.

### 3. Remove the title and subtitle inside the card
The card currently shows:
- "Bem-vindo de volta" (title div)
- "Entre com seu email e senha pra acessar seus palpites." (subtitle div)

Remove both. The tabs "Entrar / Cadastrar" already give enough context. Removing them makes the card shorter and avoids scroll on screens under 700px tall.

### 4. Reduce internal padding and spacing
Inside the card body, reduce spacing so the card fits within 100vh alongside the logo:
- Card body padding: `20px` on all sides (was `24px 28px`)
- Space between fields: `12px` margin-bottom (was `14px`)
- Button margin-top: `16px`

### 5. Add overflow hidden to html/body for the login route
Add this `useEffect` inside the LoginPage component to lock scroll while on this page:

```ts
import { useEffect } from 'react'

// inside the component, before the return:
useEffect(() => {
  document.body.style.overflow = 'hidden'
  return () => { document.body.style.overflow = '' }
}, [])
```

### 6. Reduce logo font size slightly
Logo `font-size`: `52px` (was `64px`) so it takes less vertical space on mobile.

## Visual result expected
- No scrollbar on any mobile screen (iPhone SE, iPhone 14, Android mid-range)
- Logo visible above the card
- Card centered vertically with: email field, password field, login button, divider, register link
- No header, no footer, no title or subtitle inside the card
- Background grid texture and blue glow remain unchanged

## Do NOT change
- Authentication logic (`supabase.auth.signInWithPassword`)
- Error handling and error message display
- Tab navigation to `/auth/register`
- Color tokens, fonts, or border styles
- The gradient line at the top of the card (`linear-gradient(90deg,#4A90D9,#7BB8F0,#4A90D9)`)
- The glow `<div>` (keep it as-is, it is purely decorative)
