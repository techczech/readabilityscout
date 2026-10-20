import React from 'react'
import { aliasesOf, registry } from '../../../shared/commands'

// The cheat sheet is generated from the command registry, with the user's own shortcuts applied.
export default function HelpModal({
  open,
  bindings,
  onClose
}: {
  open: boolean
  bindings: Record<string, string>
  onClose: () => void
}): React.JSX.Element {
  const groups = registry.cheatSheet(bindings)
  return (
    <div className={'modal' + (open ? ' show' : '')} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <h2>Keyboard shortcuts</h2>
      <p className="sub">
        Single-letter shortcuts work when the cursor is outside the text field. Press <kbd>Esc</kbd> to leave the text field.
        Change any shortcut in Settings › Shortcuts.
      </p>
      <table className="keys-table">
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.group}>
              <tr className="keys-group">
                <th colSpan={2} scope="colgroup">{g.group}</th>
              </tr>
              {g.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.label}</td>
                  <td>
                    {[entry.chord, ...aliasesOf(entry.id)].map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 14, textAlign: 'right' }}>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
