import React from 'react'
import { aliasesOf, registry } from '../../../shared/commands'

// The cheat sheet is generated from the command registry, with the user's own shortcuts applied.
// Every command that is not hidden is listed; a command with no shortcut shows "None".
export default function HelpModal({
  open,
  bindings,
  onClose
}: {
  open: boolean
  bindings: Record<string, string>
  onClose: () => void
}): React.JSX.Element {
  const groups = registry.groups
    .map((group) => ({
      group,
      entries: registry.defs.filter((d) => d.group === group && !d.hidden)
    }))
    .filter((g) => g.entries.length > 0)
  return (
    <div className={'modal' + (open ? ' show' : '')} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <h2>Keyboard shortcuts</h2>
      <p className="sub">
        Single-letter shortcuts work when the cursor is outside the text field. Press <kbd>Esc</kbd> to leave the text field.
        Change any shortcut in Settings › Shortcuts.
      </p>
      <div className="keys-scroll">
        <table className="keys-table">
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g.group}>
                <tr className="keys-group">
                  <th colSpan={2} scope="colgroup">{g.group}</th>
                </tr>
                {g.entries.map((entry) => {
                  const chord = bindings[entry.id]
                  const keys = chord ? [chord, ...aliasesOf(entry.id)] : []
                  return (
                    <tr key={entry.id}>
                      <td>{entry.label}</td>
                      <td>
                        {keys.length > 0 ? keys.map((k) => <kbd key={k}>{k}</kbd>) : <span className="keys-none">None</span>}
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
