import React from 'react'

const SHORTCUTS: Array<[string, string[]]> = [
  ['Open a text file', ['⌘O']],
  ['Reload the open file from disk', ['⌘⇧R']],
  ['Show this cheat-sheet', ['?']],
  ['Open / close settings', ['S']],
  ['Focus the text field', ['E']],
  ['Clear the text', ['X']],
  ['Load sample 1–4', ['1', '2', '3', '4']],
  ['Toggle unfamiliar-word marks', ['D']],
  ['Toggle academic-word marks', ['A']],
  ['Toggle long-sentence marks', ['L']],
  ['Copy the Markdown report', ['R']],
  ['Save the analysis as JSON', ['J']],
  ['Close overlays / leave the text field', ['Esc']]
]

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  return (
    <div className={'modal' + (open ? ' show' : '')} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <h2>Keyboard shortcuts</h2>
      <p className="sub">
        Single-letter shortcuts work when the cursor is outside the text field. Press <kbd>Esc</kbd> to leave the text field.
      </p>
      <table className="keys-table">
        <tbody>
          {SHORTCUTS.map(([action, keys]) => (
            <tr key={action}>
              <td>{action}</td>
              <td>
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 14, textAlign: 'right' }}>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
