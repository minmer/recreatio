import type { Copy } from '../../content/types';
import { LEGEND_ENTRIES, RELATION_COLORS } from './roleGraphConfig';

type RoleGraphControlsProps = {
  copy: Copy;
  search: string;
  onSearchChange: (value: string) => void;
  showReachable: boolean;
  onToggleReachable: (value: boolean) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  filters: Record<string, boolean>;
  onToggleFilter: (type: string, next: boolean) => void;
};

export function RoleGraphControls({
  copy,
  search,
  onSearchChange,
  showReachable,
  onToggleReachable,
  isFullscreen,
  onToggleFullscreen,
  filters,
  onToggleFilter
}: RoleGraphControlsProps) {
  return (
    <>
      <div className="role-controls">
        <input
          type="search"
          placeholder={copy.account.roles.searchPlaceholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <label className="role-toggle">
          <input
            type="checkbox"
            checked={showReachable}
            onChange={(event) => onToggleReachable(event.target.checked)}
          />
          {copy.account.roles.reachableToggle}
        </label>
        <button type="button" className="chip" onClick={onToggleFullscreen}>
          {isFullscreen ? copy.account.roles.fullscreenExit : copy.account.roles.fullscreenEnter}
        </button>
      </div>
      <div className="role-filters">
        {Object.keys(filters).length === 0 && <span className="hint">{copy.account.roles.noFilters}</span>}
        {Object.entries(filters).map(([type, enabled]) => (
          <button
            key={type}
            type="button"
            className={`chip ${enabled ? 'active' : ''}`}
            onClick={() => onToggleFilter(type, !enabled)}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="role-legend">
        <span className="hint">{copy.account.roles.legendTitle}</span>
        <div className="role-legend-items">
          {LEGEND_ENTRIES.map((entry) => (
            <div key={entry} className="role-legend-item">
              <span className="role-legend-dot" style={{ background: RELATION_COLORS[entry], borderColor: RELATION_COLORS[entry] }} />
              <span>{entry}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="role-legend-notes">
        <span className="hint">{copy.account.roles.relationNotesTitle}</span>
        <div className="role-legend-items">
          <div className="role-legend-item">
            <span>Owner</span>
            <span className="hint">{copy.account.roles.relationOwner}</span>
          </div>
          <div className="role-legend-item">
            <span>Write</span>
            <span className="hint">{copy.account.roles.relationWrite}</span>
          </div>
          <div className="role-legend-item">
            <span>Read</span>
            <span className="hint">{copy.account.roles.relationRead}</span>
          </div>
          <div className="role-legend-item">
            <span>Data</span>
            <span className="hint">{copy.account.roles.relationData}</span>
          </div>
          <div className="role-legend-item">
            <span>RecoveryOwner</span>
            <span className="hint">{copy.account.roles.relationRecoveryOwner}</span>
          </div>
          <div className="role-legend-item">
            <span>RecoveryAccess</span>
            <span className="hint">{copy.account.roles.relationRecoveryAccess}</span>
          </div>
        </div>
      </div>
    </>
  );
}
