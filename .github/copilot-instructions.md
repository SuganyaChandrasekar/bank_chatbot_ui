# Enterprise Banking Chatbot - Copilot Workspace Instructions

## 1. Core Tech Stack & Versions
- **Frontend:** React v19+ using Vite, Material UI (MUI v6+) with a custom `ThemeProvider`.
- **Backend:** Python FastAPI, LangGraph for agent orchestration, and Microsoft Presidio for real-time PII masking.
- **Styling Rules:** Use MUI's built-in `sx` prop or styled components. **Never** use Tailwind CSS, Bootstrap, or inline raw CSS stylesheets.

## 2. State Management Architecture
- **Global State:** Restricted strictly to React Context for low-frequency variables (JWT auth tokens, user session ID, theme preference, and WebSocket online/offline status).
- **Streaming & Local State:** Use custom hooks (`useRef`, `useState`) for high-frequency real-time WebSocket token streaming. **Never use Redux** and never store live message arrays inside React Context.

## 3. Security & Compliance Mandates
- **PII Protection:** All user inputs containing sensitive text (account numbers, SSNs, passwords) must trigger Microsoft Presidio masking hooks before backend transmission.
- **Audit Logging:** Every user-triggered financial transaction must map to an immutable transaction state payload (`PENDING_VALIDATION`, `SUCCESS`, `FAILED`) destined for the `chat_audit_logs` table.
- **Interactive Security Cards:** Scaffold modular, in-chat secure UI components for multi-factor authentication (MFA/OTP prompts) during high-value operations.

## 4. Accessibility (WCAG & ARIA Compliance)
- **Keyboard Navigation:** Every chat bubble, button, input box, and interactive MFA card must be fully navigable via keyboard (`Tab`, `Shift+Tab`, `Enter`, `Escape`).
- **Screen Readers:** All dynamic elements, connection status changes, and incoming bot responses must include proper `aria-live`, `aria-label`, or semantic roles to support users with accessibility needs.

## 5. Responsive Design (Mobile-First)
- **Responsive Layouts:** Use MUI `Container` with an appropriate `maxWidth` and breakpoint-based `sx` values (`xs`, `sm`, `md`, etc.) instead of fixed widths. Keep primary content centered on desktop and full-width or comfortably inset on mobile.
- **Flexible Controls:** Let quick actions, toolbars, and form controls wrap on narrow screens. Prevent flex/grid children from forcing overflow with `minWidth: 0` and wrapping text where needed; keep interactive touch targets at least 44px in size.
- **Mobile Viewports:** Keep important controls visible when the virtual keyboard opens. Prefer dynamic viewport sizing (`dvh`), safe-area insets, and independently scrollable content over fixed heights that clip the composer.
- **Responsive Typography:** Scale heading variants and spacing at MUI breakpoints so titles and labels do not clip or overlap on small screens.
- **Verification:** Check representative mobile, tablet, and desktop widths for horizontal overflow, clipped text, reachable controls, and keyboard-safe input placement.
