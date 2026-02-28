

## Plan: Move "Accounts" to Money Movement & Restyle Payments & Bills

### Changes in `src/pages/customer-app/CustomerHome.tsx`

**1. Move "Accounts" from `financialHealth` array to `moneyMovement` array (line 54 → line 36)**
- Remove the Accounts entry from `financialHealth` (line 54)
- Add it as the last item in `moneyMovement` with matching style

**2. Restyle Payments & Bills section (lines 250-260) to use circle icons, smaller layout**
- Change icon containers from `rounded-2xl h-12 w-12` to `rounded-full h-10 w-10`
- Reduce card padding and min-width
- Make the overall items more compact with circle aesthetic

### Summary of visual changes
- "Accounts" card appears alongside Add Money, Transfer, Cash Out, Request, Pay Links in Money Movement
- Payments & Bills items (Bills, Invoices, Split Bills, Recurring) render with smaller circular icon containers and tighter spacing

