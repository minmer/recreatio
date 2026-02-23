import { useEffect, useMemo, useState } from 'react';
import type { Copy } from '../../content/types';
import { createRole, getRoles, type RoleResponse } from '../../lib/api';

function getRoleField(role: RoleResponse, fieldType: string) {
  return role.fields.find((field) => field.fieldType === fieldType)?.plainValue?.trim() ?? '';
}

function isPersonRole(role: RoleResponse) {
  return getRoleField(role, 'role_kind').toLowerCase() === 'person';
}

function getPersonRoleLabel(role: RoleResponse) {
  return (
    getRoleField(role, 'label') ||
    getRoleField(role, 'display_name') ||
    getRoleField(role, 'name') ||
    role.roleId
  );
}

export function CogitaPersonsPage({
  copy,
  onPersonCreated
}: {
  copy: Copy;
  onPersonCreated?: (roleId: string) => void;
}) {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [personName, setPersonName] = useState('');

  const loadRoles = async () => {
    setStatus('loading');
    try {
      const items = await getRoles();
      setRoles(items);
      setStatus('ready');
    } catch {
      setRoles([]);
      setStatus('error');
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const persons = useMemo(
    () =>
      roles
        .filter(isPersonRole)
        .map((role) => ({
          roleId: role.roleId,
          label: getPersonRoleLabel(role)
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [roles]
  );

  const handleCreate = async () => {
    const label = personName.trim();
    if (!label) {
      setCreateStatus('Name is required.');
      return;
    }
    setSaving(true);
    setCreateStatus(null);
    try {
      const created = await createRole({
        fields: [
          { fieldType: 'nick', plainValue: label },
          { fieldType: 'role_kind', plainValue: 'person' },
          { fieldType: 'label', plainValue: label },
          { fieldType: 'display_name', plainValue: label }
        ]
      });
      setPersonName('');
      setCreateStatus('Person role created.');
      onPersonCreated?.(created.roleId);
      await loadRoles();
    } catch {
      setCreateStatus('Failed to create person role.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cogita-library-dashboard" data-mode="detail">
      <div className="cogita-library-layout">
        <div className="cogita-library-content">
          <section className="cogita-browser-panel">
              <div className="cogita-info-overview-head">
                <div>
                  <p className="cogita-user-kicker">Cogita</p>
                  <h2 className="cogita-card-title">Persons</h2>
                  <p className="cogita-card-subtitle">Select reviewer persons in the header and create new person roles here.</p>
                </div>
              </div>
              <div className="cogita-info-overview-panels">
                <article className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">Create</p>
                      <h3 className="cogita-detail-title">New person role</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    <label className="cogita-field full">
                      <span>Name</span>
                      <input
                        type="text"
                        value={personName}
                        onChange={(event) => setPersonName(event.target.value)}
                        placeholder="e.g. Anna Kowalska"
                        disabled={saving}
                      />
                    </label>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={handleCreate} disabled={saving}>
                        {saving ? 'Creating...' : 'Create person'}
                      </button>
                    </div>
                    {createStatus ? <p className="cogita-library-hint">{createStatus}</p> : null}
                  </div>
                </article>

                <article className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">Overview</p>
                      <h3 className="cogita-detail-title">All person roles</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    {status === 'loading' ? <p>Loading persons...</p> : null}
                    {status === 'error' ? <p>Failed to load persons.</p> : null}
                    {status === 'ready' && persons.length === 0 ? <p>No person roles found.</p> : null}
                    {status === 'ready' && persons.length > 0 ? (
                      <div className="cogita-details-grid">
                        <div className="cogita-details-grid-head" role="row">
                          <span />
                          <span>Name</span>
                          <span>Type</span>
                          <span>Role ID</span>
                          <span />
                        </div>
                        {persons.map((person) => (
                          <div key={person.roleId} className="cogita-details-row" role="row">
                            <span />
                            <span title={person.label}>{person.label}</span>
                            <span>person</span>
                            <span title={person.roleId}>{person.roleId}</span>
                            <span />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
          </section>
        </div>
      </div>
    </section>
  );
}
