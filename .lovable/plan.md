

# Dark Theme Code Blocks for API Documentation

## What Changes

Apply a dark background (`bg-gray-950` / `bg-[#0d1117]`) with light syntax-colored text to all code display areas across the two shared components used by every API doc page.

## Files to Modify (2)

### 1. `src/components/developer/ApiEndpoint.tsx`
- **Endpoint path badge** (line 46-48): Change `bg-muted` to dark bg with light green text (`bg-gray-950 text-green-400`)
- **Request Body `<pre>`** (line 87): Replace `bg-muted` with `bg-[#0d1117] text-gray-100 border border-white/10`
- **Response `<pre>`** (line 97): Same dark styling
- **Example `<pre>`** (line 107): Same dark styling
- Add a copy-to-clipboard button on each code block (request body, response, example) for consistency with CodeBlock
- Add a small label pill (e.g., "REQUEST", "RESPONSE") inside the dark block header area

### 2. `src/components/developer/CodeBlock.tsx`
- **Single-example container** (line 28): Change `bg-card` to `bg-[#0d1117] text-gray-100`
- **Title bar** (line 30): Change `bg-muted/50` to `bg-gray-900 text-gray-400 border-white/10`
- **`<pre>` blocks** (lines 43, 79): Already inherits — just ensure text is `text-gray-100`
- **Multi-example container** (line 52): Same dark bg
- **Tab triggers**: Style with `text-gray-400 data-[state=active]:text-white` for contrast
- **Copy button**: Use `text-gray-400 hover:text-white` ghost variant

### Styling Spec
- Background: `#0d1117` (GitHub-dark inspired)
- Text: `text-gray-100` for code, `text-gray-400` for labels
- Border: `border border-white/10` with `rounded-lg`
- Scrollbar: inherits from `overflow-x-auto`
- Copy button: light icon on dark, positioned top-right

### Scope
These two components are the **only** code rendering components — all API doc pages (Gateway Charges, Refunds, Disputes, Settlements, Tokenization, etc.) automatically inherit the dark code blocks without any per-page changes.

