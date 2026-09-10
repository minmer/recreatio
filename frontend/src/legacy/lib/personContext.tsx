import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createRole, getRoles, type RoleResponse } from './api';
import { useAuth } from './authContext';

const STORAGE_KEY = 'recreatio.activePerson';

export type Person = { roleId: string; label: string };

type PersonContextValue = {
  persons: Person[];
  activePerson: Person | null;
  personCardOpen: boolean;
  personCardForced: boolean;
  setActivePerson: (person: Person) => void;
  openPersonCard: () => void;
  closePersonCard: () => void;
  reloadPersons: () => Promise<void>;
  createPerson: (name: string) => Promise<Person>;
};

function getRoleField(role: RoleResponse, fieldType: string) {
  return role.fields.find((f) => f.fieldType === fieldType)?.plainValue?.trim() ?? '';
}

function isPersonRole(role: RoleResponse) {
  return getRoleField(role, 'role_kind').toLowerCase() === 'person';
}

function getPersonLabel(role: RoleResponse) {
  return (
    getRoleField(role, 'label') ||
    getRoleField(role, 'display_name') ||
    getRoleField(role, 'nick') ||
    role.roleId
  );
}

function loadStoredPersonId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePersonId(roleId: string | null) {
  try {
    if (roleId) localStorage.setItem(STORAGE_KEY, roleId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const PersonContext = createContext<PersonContextValue | null>(null);

export function PersonProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [persons, setPersons] = useState<Person[]>([]);
  const [activePerson, setActivePersonState] = useState<Person | null>(null);
  const [personCardOpen, setPersonCardOpen] = useState(false);
  const [personCardForced, setPersonCardForced] = useState(false);

  const fetchPersons = useCallback(async (): Promise<Person[]> => {
    const roles = await getRoles();
    return roles
      .filter(isPersonRole)
      .map((role) => ({ roleId: role.roleId, label: getPersonLabel(role) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  useEffect(() => {
    if (!session) {
      setPersons([]);
      setActivePersonState(null);
      setPersonCardOpen(false);
      setPersonCardForced(false);
      return;
    }

    let active = true;
    const run = async () => {
      let list: Person[];
      try {
        list = await fetchPersons();
      } catch {
        list = [];
      }
      if (!active) return;

      setPersons(list);

      if (list.length === 0) {
        setActivePersonState(null);
        setPersonCardForced(true);
        setPersonCardOpen(true);
        return;
      }

      const storedId = loadStoredPersonId();
      const stored = storedId ? (list.find((p) => p.roleId === storedId) ?? null) : null;
      const selected = stored ?? list[0];
      setActivePersonState(selected);
      savePersonId(selected.roleId);
    };

    void run();
    return () => {
      active = false;
    };
  }, [session, fetchPersons]);

  const setActivePerson = useCallback((person: Person) => {
    setActivePersonState(person);
    savePersonId(person.roleId);
    setPersonCardOpen(false);
    setPersonCardForced(false);
  }, []);

  const openPersonCard = useCallback(() => {
    setPersonCardForced(false);
    setPersonCardOpen(true);
  }, []);

  const closePersonCard = useCallback(() => {
    setPersonCardOpen(false);
  }, []);

  const reloadPersons = useCallback(async () => {
    const list = await fetchPersons();
    setPersons(list);
  }, [fetchPersons]);

  const createPerson = useCallback(async (name: string): Promise<Person> => {
    const label = name.trim();
    const created = await createRole({
      fields: [
        { fieldType: 'nick', plainValue: label },
        { fieldType: 'role_kind', plainValue: 'person' },
        { fieldType: 'label', plainValue: label },
        { fieldType: 'display_name', plainValue: label }
      ]
    });
    const person: Person = { roleId: created.roleId, label };
    setPersons((prev) =>
      [...prev, person].sort((a, b) => a.label.localeCompare(b.label))
    );
    return person;
  }, []);

  const value = useMemo<PersonContextValue>(
    () => ({
      persons,
      activePerson,
      personCardOpen,
      personCardForced,
      setActivePerson,
      openPersonCard,
      closePersonCard,
      reloadPersons,
      createPerson
    }),
    [persons, activePerson, personCardOpen, personCardForced, setActivePerson, openPersonCard, closePersonCard, reloadPersons, createPerson]
  );

  return <PersonContext.Provider value={value}>{children}</PersonContext.Provider>;
}

export function usePersonContext() {
  const context = useContext(PersonContext);
  if (!context) throw new Error('usePersonContext must be used within PersonProvider');
  return context;
}
