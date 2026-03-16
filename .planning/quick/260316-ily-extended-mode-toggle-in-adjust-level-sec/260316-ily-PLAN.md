---
phase: quick
plan: 260316-ily
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/pages/ProgressPage.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Extended Tables toggle is visible at the bottom of the Adjust Level card when isMaxTier is true"
    - "Toggle is a pill-shaped checkbox switch, not a button"
    - "Five number badges ×11 ×12 ×15 ×20 ×25 display inline next to the label"
    - "Toggle still calls handleToggleExtended and respects extendedSaving"
    - "Old toggle in mastery card (#mastery) is fully removed"
  artifacts:
    - path: "client/src/pages/ProgressPage.tsx"
      provides: "Updated ProgressPage with toggle in Adjust Level card"
  key_links:
    - from: "pill switch checkbox"
      to: "handleToggleExtended"
      via: "onChange handler"
      pattern: "onChange.*handleToggleExtended"
---

<objective>
Move the Extended Tables toggle from the mastery card into the Adjust Level card as a pill-shaped checkbox switch with inline number badges.

Purpose: Better UX — the toggle lives where the user is already thinking about their level, and the number preview makes the unlock value immediately obvious.
Output: Updated ProgressPage.tsx with toggle in new location, mastery card toggle removed.
</objective>

<execution_context>
@/Users/lbi/Projects/spacetimemath/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lbi/Projects/spacetimemath/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@client/src/pages/ProgressPage.tsx
@client/src/locales/en/translation.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move Extended Tables toggle to Adjust Level card as pill switch</name>
  <files>client/src/pages/ProgressPage.tsx</files>
  <action>
In `ProgressPage.tsx`, make two changes:

**1. Remove the toggle from the mastery card.**

Delete the entire `{isMaxTier && (...)}` block inside `#mastery` (lines 142–153):
```tsx
{isMaxTier && (
  <div className="row-between mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
    <span className="fw-semibold text-sm">{t('extendedTables.toggle')}</span>
    <button
      className={`btn btn-sm ${extendedMode ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => handleToggleExtended(!extendedMode)}
      disabled={extendedSaving}
    >
      {extendedMode ? t('extendedTables.on') : t('extendedTables.off')}
    </button>
  </div>
)}
```

**2. Add the pill-switch row at the bottom of the Adjust Level card.**

After the closing `</TierLadder>` / adjusting branch (after `</> : (<TierLadder .../>) }`), but still inside the `.card.col.gap-12` div (before its closing `</div>`), add:

```tsx
{isMaxTier && (
  <div
    style={{
      borderTop: '1px solid var(--border)',
      paddingTop: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    }}
  >
    <label
      htmlFor="extended-toggle"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: extendedSaving ? 'not-allowed' : 'pointer',
        opacity: extendedSaving ? 0.6 : 1,
        flex: 1,
        minWidth: 0,
        flexWrap: 'wrap',
      }}
    >
      <span className="fw-semibold text-sm" style={{ whiteSpace: 'nowrap' }}>
        {t('extendedTables.toggle')}
      </span>
      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[11, 12, 15, 20, 25].map(n => (
          <span
            key={n}
            className="text-xs"
            style={{
              background: 'var(--card2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 12,
              padding: '2px 8px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ×{n}
          </span>
        ))}
      </span>
    </label>

    {/* Pill switch */}
    <label
      htmlFor="extended-toggle"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: 44,
        height: 24,
        flexShrink: 0,
        cursor: extendedSaving ? 'not-allowed' : 'pointer',
        opacity: extendedSaving ? 0.6 : 1,
      }}
    >
      <input
        id="extended-toggle"
        type="checkbox"
        checked={extendedMode}
        disabled={extendedSaving}
        onChange={e => handleToggleExtended(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      {/* Track */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 24,
          background: extendedMode ? 'var(--accent)' : 'var(--card2)',
          border: `1px solid ${extendedMode ? 'var(--accent)' : 'var(--border)'}`,
          transition: 'background 0.2s, border-color 0.2s',
        }}
      />
      {/* Thumb */}
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: extendedMode ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: extendedMode ? '#fff' : 'var(--muted)',
          transition: 'left 0.2s, background 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </label>
  </div>
)}
```

Place this block immediately after the ternary `adjusting ? (...) : (...)` expression, still inside the `.card.col.gap-12` div.
  </action>
  <verify>
    <automated>cd /Users/lbi/Projects/spacetimemath/client && npm test 2>&1 | tail -20</automated>
  </verify>
  <done>
- Toggle no longer appears in the mastery card
- Pill switch row appears at bottom of Adjust Level card when isMaxTier (tier 7)
- Five ×N badges visible next to label
- Switch thumb moves right when extendedMode=true, left when false
- Track turns accent yellow when enabled
- Clicking the label or the switch calls handleToggleExtended with the new boolean
- npm test passes
  </done>
</task>

</tasks>

<verification>
1. Open ProgressPage as a Master-level (tier 7) player
2. Scroll to "Adjust Level" card — extended mode row appears below the tier ladder with pill switch and ×11 ×12 ×15 ×20 ×25 badges
3. Click switch — thumb slides right, track turns yellow, reducer fires
4. Click again — thumb slides left, track returns to default
5. Mastery card has no toggle (no button, no row)
6. npm test passes
</verification>

<success_criteria>
Toggle moved to Adjust Level card as pill switch. Mastery card toggle removed. Number badges visible. Reducer call unchanged.
</success_criteria>

<output>
After completion, create `.planning/quick/260316-ily-extended-mode-toggle-in-adjust-level-sec/260316-ily-SUMMARY.md`
</output>
