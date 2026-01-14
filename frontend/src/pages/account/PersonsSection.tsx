import { useEffect, useMemo, useState } from 'react';
import type { Copy } from '../../content/types';
import {
  acceptRoleShare,
  createPerson,
  getPersonAccess,
  getPendingRoleShares,
  getPersons,
  issueCsrf,
  lookupRoleByLogin,
  sharePersonRole,
  updatePersonField,
  type PendingRoleShareResponse,
  type PersonAccessResponse,
  type PersonFieldResponse,
  type PersonResponse
} from '../../lib/api';

type Status = { type: 'idle' | 'working' | 'success' | 'error'; message?: string };

type PersonView = {
  personRoleId: string;
  publicSigningKeyBase64?: string | null;
  publicSigningKeyAlg?: string | null;
  fields: PersonFieldResponse[];
  name: string;
};

const updateFields = (fields: PersonFieldResponse[], updated: PersonFieldResponse) => {
  const index = fields.findIndex((field) => field.fieldType === updated.fieldType);
  if (index === -1) {
    return [...fields, updated];
  }
  return fields.map((field, idx) => (idx === index ? updated : field));
};

const toPersonView = (person: PersonResponse, fallback: string, encryptedPlaceholder: string): PersonView => {
  const getField = (fieldType: string) => {
    const match = person.fields.find((field) => field.fieldType === fieldType);
    if (!match) return fallback;
    const plain = match.plainValue?.trim();
    return plain && plain.length > 0 ? plain : encryptedPlaceholder;
  };

  return {
    personRoleId: person.personRoleId,
    publicSigningKeyBase64: person.publicSigningKeyBase64 ?? null,
    publicSigningKeyAlg: person.publicSigningKeyAlg ?? null,
    fields: person.fields,
    name: getField('name')
  };
};

export function PersonsSection({ copy }: { copy: Copy }) {
  const [persons, setPersons] = useState<PersonView[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createStatus, setCreateStatus] = useState<Status>({ type: 'idle' });
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<Status>({ type: 'idle' });
  const [accessOpenId, setAccessOpenId] = useState<string | null>(null);
  const [accessByPerson, setAccessByPerson] = useState<Record<string, PersonAccessResponse>>({});
  const [accessStatus, setAccessStatus] = useState<Record<string, Status>>({});
  const [memberInputs, setMemberInputs] = useState<
    Record<string, { targetRoleId: string; relationshipType: string; lookupLoginId: string }>
  >({});
  const [memberStatus, setMemberStatus] = useState<Record<string, Status>>({});
  const [dataInputs, setDataInputs] = useState<
    Record<string, { fieldType: string; value: string; dataKeyId?: string | null }>
  >({});
  const [dataStatus, setDataStatus] = useState<Record<string, Status>>({});
  const [pendingByRole, setPendingByRole] = useState<Record<string, PendingRoleShareResponse[]>>({});
  const [pendingStatus, setPendingStatus] = useState<Status>({ type: 'idle' });

  const relationshipOptions = useMemo(
    () => [
      { value: 'PersonRead', label: copy.account.persons.roleRead },
      { value: 'PersonWrite', label: copy.account.persons.roleWrite },
      { value: 'PersonRecovery', label: copy.account.persons.roleRecovery },
      { value: 'PersonOwner', label: copy.account.persons.roleOwner }
    ],
    [copy.account.persons.roleOwner, copy.account.persons.roleRead, copy.account.persons.roleRecovery, copy.account.persons.roleWrite]
  );

  useEffect(() => {
    let active = true;
    const loadPersons = async () => {
      setLoading(true);
      try {
        await issueCsrf();
        const data = await getPersons();
        if (!active) return;
        setPersons(data.map((person) => toPersonView(person, copy.account.persons.missingField, copy.account.persons.encryptedPlaceholder)));
        const pending = await getPendingRoleShares();
        if (!active) return;
        const grouped = pending.reduce<Record<string, PendingRoleShareResponse[]>>((acc, share) => {
          const list = acc[share.targetRoleId] ?? [];
          acc[share.targetRoleId] = [...list, share];
          return acc;
        }, {});
        setPendingByRole(grouped);
        setPendingStatus({ type: 'success' });
      } catch {
        if (!active) return;
        setPendingStatus({ type: 'error', message: copy.account.persons.pendingError });
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    loadPersons();
    return () => {
      active = false;
    };
  }, [copy.account.persons.encryptedPlaceholder, copy.account.persons.missingField]);

  const refreshAccess = async (personRoleId: string) => {
    setAccessStatus((prev) => ({ ...prev, [personRoleId]: { type: 'working' } }));
    try {
      await issueCsrf();
      const data = await getPersonAccess(personRoleId);
      setAccessByPerson((prev) => ({ ...prev, [personRoleId]: data }));
      setAccessStatus((prev) => ({ ...prev, [personRoleId]: { type: 'success' } }));
    } catch {
      setAccessStatus((prev) => ({ ...prev, [personRoleId]: { type: 'error', message: copy.account.persons.accessError } }));
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateStatus({ type: 'idle' });

    if (!createName.trim()) {
      setCreateStatus({ type: 'error', message: copy.account.persons.createMissing });
      return;
    }

    setCreateStatus({ type: 'working', message: copy.account.persons.createWorking });
    try {
      await issueCsrf();
      const response = await createPerson({
        fields: [
          {
            fieldType: 'name',
            plainValue: createName.trim()
          }
        ],
        publicSigningKeyBase64: null,
        publicSigningKeyAlg: null,
        signatureBase64: null
      });
      const view = toPersonView(response, copy.account.persons.missingField, copy.account.persons.encryptedPlaceholder);
      setPersons((prev) => [...prev, view]);
      setCreateStatus({ type: 'success', message: copy.account.persons.createSuccess });
      setCreateName('');
      setCreateOpen(false);
    } catch {
      setCreateStatus({ type: 'error', message: copy.account.persons.createError });
    }
  };

  const startEdit = (person: PersonView) => {
    setEditPersonId(person.personRoleId);
    setEditName(person.name);
    setEditStatus({ type: 'idle' });
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editPersonId) return;
    const person = persons.find((item) => item.personRoleId === editPersonId);
    if (!person) return;

    const nextName = editName.trim();
    if (!nextName) {
      setEditStatus({ type: 'error', message: copy.account.persons.createMissing });
      return;
    }

    setEditStatus({ type: 'working', message: copy.account.persons.editWorking });
    try {
      await issueCsrf();
      let updatedFields = person.fields;
      if (nextName !== person.name) {
        const updated = await updatePersonField(editPersonId, {
          fieldType: 'name',
          plainValue: nextName
        });
        updatedFields = updateFields(updatedFields, updated);
      }

      setPersons((prev) =>
        prev.map((item) =>
          item.personRoleId === editPersonId
            ? { ...item, fields: updatedFields, name: nextName }
            : item
        )
      );
      setEditStatus({ type: 'success', message: copy.account.persons.editSuccess });
      setEditPersonId(null);
    } catch {
      setEditStatus({ type: 'error', message: copy.account.persons.editError });
    }
  };

  const toggleAccess = async (personRoleId: string) => {
    if (accessOpenId === personRoleId) {
      setAccessOpenId(null);
      return;
    }
    setAccessOpenId(personRoleId);
    if (!accessByPerson[personRoleId]) {
      await refreshAccess(personRoleId);
    }
  };

  const handleAddMember = async (event: React.FormEvent, personRoleId: string) => {
    event.preventDefault();
    const input = memberInputs[personRoleId] ?? {
      targetRoleId: '',
      relationshipType: relationshipOptions[0]?.value ?? 'PersonRead',
      lookupLoginId: ''
    };
    if (!input.targetRoleId.trim()) {
      setMemberStatus((prev) => ({ ...prev, [personRoleId]: { type: 'error', message: copy.account.persons.memberMissing } }));
      return;
    }

    setMemberStatus((prev) => ({ ...prev, [personRoleId]: { type: 'working', message: copy.account.persons.memberWorking } }));
    try {
      await issueCsrf();
      await sharePersonRole(personRoleId, {
        targetRoleId: input.targetRoleId.trim(),
        relationshipType: input.relationshipType,
        signatureBase64: null
      });
      setMemberStatus((prev) => ({ ...prev, [personRoleId]: { type: 'success', message: copy.account.persons.memberSuccess } }));
      setMemberInputs((prev) => ({
        ...prev,
        [personRoleId]: { ...input, targetRoleId: '', lookupLoginId: '' }
      }));
      if (accessOpenId === personRoleId) {
        await refreshAccess(personRoleId);
      }
    } catch {
      setMemberStatus((prev) => ({ ...prev, [personRoleId]: { type: 'error', message: copy.account.persons.memberError } }));
    }
  };

  const formatRelationship = (value: string) => {
    const match = relationshipOptions.find((option) => option.value === value);
    return match ? match.label : value;
  };

  const handleAcceptShare = async (shareId: string, targetRoleId: string) => {
    setPendingStatus({ type: 'working', message: copy.account.persons.pendingWorking });
    try {
      await issueCsrf();
      await acceptRoleShare(shareId, { signatureBase64: null });
      setPendingByRole((prev) => ({
        ...prev,
        [targetRoleId]: (prev[targetRoleId] ?? []).filter((share) => share.shareId !== shareId)
      }));
      setPendingStatus({ type: 'success', message: copy.account.persons.pendingSuccess });
      await refreshAccess(targetRoleId);
    } catch {
      setPendingStatus({ type: 'error', message: copy.account.persons.pendingError });
    }
  };

  const handleDataSave = async (event: React.FormEvent, personRoleId: string) => {
    event.preventDefault();
    const input = dataInputs[personRoleId] ?? { fieldType: '', value: '', dataKeyId: null };
    const fieldType = input.fieldType.trim();
    const value = input.value.trim();
    if (!fieldType || !value) {
      setDataStatus((prev) => ({ ...prev, [personRoleId]: { type: 'error', message: copy.account.persons.dataMissing } }));
      return;
    }

    setDataStatus((prev) => ({ ...prev, [personRoleId]: { type: 'working', message: copy.account.persons.dataWorking } }));
    try {
      await issueCsrf();
      const updated = await updatePersonField(personRoleId, {
        fieldType,
        plainValue: value,
        dataKeyId: input.dataKeyId ?? undefined
      });

      setPersons((prev) =>
        prev.map((person) => {
          if (person.personRoleId !== personRoleId) {
            return person;
          }
          const nextFields = updateFields(person.fields, updated);
          const nextName = fieldType === 'name' ? value : person.name;
          return { ...person, fields: nextFields, name: nextName };
        })
      );
      setDataInputs((prev) => ({ ...prev, [personRoleId]: { fieldType: '', value: '', dataKeyId: null } }));
      setDataStatus((prev) => ({ ...prev, [personRoleId]: { type: 'success', message: copy.account.persons.dataSuccess } }));
    } catch {
      setDataStatus((prev) => ({ ...prev, [personRoleId]: { type: 'error', message: copy.account.persons.dataError } }));
    }
  };

  const handleLookupRole = async (personRoleId: string) => {
    const input = memberInputs[personRoleId] ?? {
      targetRoleId: '',
      relationshipType: relationshipOptions[0]?.value ?? 'PersonRead',
      lookupLoginId: ''
    };
    const loginId = input.lookupLoginId.trim();
    if (!loginId) {
      setMemberStatus((prev) => ({ ...prev, [personRoleId]: { type: 'error', message: copy.account.persons.lookupMissing } }));
      return;
    }

    setMemberStatus((prev) => ({ ...prev, [personRoleId]: { type: 'working', message: copy.account.persons.lookupWorking } }));
    try {
      await issueCsrf();
      const result = await lookupRoleByLogin(loginId);
      setMemberInputs((prev) => ({
        ...prev,
        [personRoleId]: {
          ...input,
          targetRoleId: result.masterRoleId,
          lookupLoginId: loginId
        }
      }));
      setMemberStatus((prev) => ({ ...prev, [personRoleId]: { type: 'success', message: copy.account.persons.lookupSuccess } }));
    } catch {
      setMemberStatus((prev) => ({ ...prev, [personRoleId]: { type: 'error', message: copy.account.persons.lookupError } }));
    }
  };

  return (
    <section className="account-card" id="persons">
      <h3>{copy.account.sections.persons}</h3>
      <p className="note">{copy.account.persons.lead}</p>
      <div className="account-row">
        <button type="button" className="ghost" onClick={() => setCreateOpen((prev) => !prev)}>
          {copy.account.persons.addToggle}
        </button>
      </div>
      {createOpen && (
        <form className="account-form" onSubmit={handleCreate}>
          <label>
            {copy.account.persons.nameLabel}
            <input
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={copy.account.persons.namePlaceholder}
            />
          </label>
          <button type="submit" className="cta">
            {copy.account.persons.createAction}
          </button>
        </form>
      )}
      {createStatus.type !== 'idle' && (
        <div className={`status ${createStatus.type === 'working' ? '' : createStatus.type}`}>
          <strong>{copy.access.statusTitle}</strong>
          <span>{createStatus.message ?? copy.access.statusReady}</span>
        </div>
      )}

      {loading && <p className="hint">{copy.account.persons.loading}</p>}
      {!loading && persons.length === 0 && <p className="hint">{copy.account.persons.empty}</p>}

      <div className="account-persons">
        {persons.map((person) => {
          const access = accessByPerson[person.personRoleId];
          const accessState = accessStatus[person.personRoleId]?.type ?? 'idle';
          const input = memberInputs[person.personRoleId] ?? {
            targetRoleId: '',
            relationshipType: relationshipOptions[0]?.value ?? 'PersonRead',
            lookupLoginId: ''
          };
          const memberState = memberStatus[person.personRoleId];
          const dataInput = dataInputs[person.personRoleId] ?? { fieldType: '', value: '', dataKeyId: null };
          const currentDataStatus = dataStatus[person.personRoleId];
          const pendingShares = pendingByRole[person.personRoleId] ?? [];
          return (
            <article className="person-card" key={person.personRoleId}>
              <div className="person-header">
                <div className="person-meta">
                  <strong>{person.name}</strong>
                </div>
                <div className="person-actions">
                  <button type="button" className="ghost" onClick={() => startEdit(person)}>
                    {copy.account.persons.editToggle}
                  </button>
                  <button type="button" className="ghost" onClick={() => toggleAccess(person.personRoleId)}>
                    {copy.account.persons.accessToggle}
                  </button>
                </div>
              </div>

              {editPersonId === person.personRoleId && (
                <form className="account-form" onSubmit={handleEdit}>
                  <label>
                    {copy.account.persons.nameLabel}
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                  </label>
                  <div className="person-actions">
                    <button type="submit" className="cta">
                      {copy.account.persons.editAction}
                    </button>
                    <button type="button" className="ghost" onClick={() => setEditPersonId(null)}>
                      {copy.account.persons.editCancel}
                    </button>
                  </div>
                </form>
              )}
              {editStatus.type !== 'idle' && editPersonId === person.personRoleId && (
                <div className={`status ${editStatus.type === 'working' ? '' : editStatus.type}`}>
                  <strong>{copy.access.statusTitle}</strong>
                  <span>{editStatus.message ?? copy.access.statusReady}</span>
                </div>
              )}

              <div className="person-data">
                <div className="account-row">
                  <strong>{copy.account.persons.dataTitle}</strong>
                </div>
                {person.fields.length === 0 && <p className="hint">{copy.account.persons.dataEmpty}</p>}
                {person.fields.length > 0 && (
                  <div className="person-data-list">
                    {person.fields.map((field) => (
                      <div className="person-data-item" key={field.fieldType}>
                        <div>
                          <span className="note">{field.fieldType}</span>
                          <strong>{field.plainValue?.trim() || copy.account.persons.encryptedPlaceholder}</strong>
                        </div>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            setDataInputs((prev) => ({
                              ...prev,
                              [person.personRoleId]: {
                                fieldType: field.fieldType,
                                value: field.plainValue ?? '',
                                dataKeyId: field.dataKeyId
                              }
                            }))
                          }
                        >
                          {copy.account.persons.dataEdit}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form className="account-form" onSubmit={(event) => handleDataSave(event, person.personRoleId)}>
                  <label>
                    {copy.account.persons.dataTypeLabel}
                    <input
                      type="text"
                      value={dataInput.fieldType}
                      onChange={(event) =>
                        setDataInputs((prev) => ({
                          ...prev,
                          [person.personRoleId]: { ...dataInput, fieldType: event.target.value }
                        }))
                      }
                      placeholder={copy.account.persons.dataTypePlaceholder}
                    />
                  </label>
                  <label>
                    {copy.account.persons.dataValueLabel}
                    <input
                      type="text"
                      value={dataInput.value}
                      onChange={(event) =>
                        setDataInputs((prev) => ({
                          ...prev,
                          [person.personRoleId]: { ...dataInput, value: event.target.value }
                        }))
                      }
                      placeholder={copy.account.persons.dataValuePlaceholder}
                    />
                  </label>
                  <div className="person-actions">
                    <button type="submit" className="cta">
                      {copy.account.persons.dataAction}
                    </button>
                  </div>
                </form>
                {currentDataStatus?.type && currentDataStatus.type !== 'idle' && (
                  <div className={`status ${currentDataStatus.type === 'working' ? '' : currentDataStatus.type}`}>
                    <strong>{copy.access.statusTitle}</strong>
                    <span>{currentDataStatus.message ?? copy.access.statusReady}</span>
                  </div>
                )}
              </div>

              {accessOpenId === person.personRoleId && (
                <div className="person-access">
                  <div className="account-row">
                    <strong>{copy.account.persons.accessTitle}</strong>
                    <button type="button" className="ghost" onClick={() => refreshAccess(person.personRoleId)}>
                      {copy.account.persons.accessRefresh}
                    </button>
                  </div>
                  {accessState === 'working' && <p className="hint">{copy.account.persons.accessLoading}</p>}
                  {accessState === 'error' && <p className="hint">{copy.account.persons.accessError}</p>}
                  {access && access.roles.length === 0 && <p className="hint">{copy.account.persons.accessEmpty}</p>}
                  {access && access.roles.length > 0 && (
                    <div className="person-members">
                      {access.roles.map((role) => (
                        <div className="person-member" key={role.roleId}>
                          <div className="person-member-header">
                            <strong>{role.roleType}</strong>
                            <span className="note">{formatRelationship(role.relationshipType)}</span>
                          </div>
                          <span className="hint">{role.roleId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {pendingShares.length > 0 && (
                    <div className="person-members">
                      <strong>{copy.account.persons.pendingTitle}</strong>
                      {pendingShares.map((share) => (
                        <div className="person-member" key={share.shareId}>
                          <div className="person-member-header">
                            <strong>{share.sourceRoleId}</strong>
                            <span className="note">{formatRelationship(share.relationshipType)}</span>
                          </div>
                          <div className="person-actions">
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => handleAcceptShare(share.shareId, person.personRoleId)}
                            >
                              {copy.account.persons.pendingAccept}
                            </button>
                          </div>
                        </div>
                      ))}
                      {pendingStatus.type !== 'idle' && (
                        <div className={`status ${pendingStatus.type === 'working' ? '' : pendingStatus.type}`}>
                          <strong>{copy.access.statusTitle}</strong>
                          <span>{pendingStatus.message ?? copy.access.statusReady}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <form className="account-form" onSubmit={(event) => handleAddMember(event, person.personRoleId)}>
                    <h4>{copy.account.persons.memberTitle}</h4>
                    <label>
                      {copy.account.persons.lookupLabel}
                      <input
                        type="text"
                        value={input.lookupLoginId}
                        onChange={(event) =>
                          setMemberInputs((prev) => ({
                            ...prev,
                            [person.personRoleId]: { ...input, lookupLoginId: event.target.value }
                          }))
                        }
                        placeholder={copy.account.persons.lookupPlaceholder}
                      />
                    </label>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleLookupRole(person.personRoleId)}
                    >
                      {copy.account.persons.lookupAction}
                    </button>
                    <label>
                      {copy.account.persons.memberRoleLabel}
                      <input
                        type="text"
                        value={input.targetRoleId}
                        onChange={(event) =>
                          setMemberInputs((prev) => ({
                            ...prev,
                            [person.personRoleId]: { ...input, targetRoleId: event.target.value }
                          }))
                        }
                        placeholder={copy.account.persons.memberRolePlaceholder}
                      />
                    </label>
                    <label>
                      {copy.account.persons.memberTypeLabel}
                      <select
                        value={input.relationshipType}
                        onChange={(event) =>
                          setMemberInputs((prev) => ({
                            ...prev,
                            [person.personRoleId]: { ...input, relationshipType: event.target.value }
                          }))
                        }
                      >
                        {relationshipOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="ghost">
                      {copy.account.persons.memberAction}
                    </button>
                  </form>
                  {memberState?.type && memberState.type !== 'idle' && (
                    <div className={`status ${memberState.type === 'working' ? '' : memberState.type}`}>
                      <strong>{copy.access.statusTitle}</strong>
                      <span>{memberState.message ?? copy.access.statusReady}</span>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
