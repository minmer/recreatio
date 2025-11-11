import { useEffect, useState } from 'react';

// Typ zgodny z modelem w backendzie
type Parish = {
  id: number;
  slug: string;
  name: string;
  city: string;
};

// ⚠️ USTAW tutaj adres backendu – port sprawdź w konsoli `dotnet run`
const API_BASE_URL = 'http://localhost:5217'; // jeśli u Ciebie jest np. 5000, zmień na ten port
const PARISHES_URL = `${API_BASE_URL}/api/parishes`;

function App() {
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadParishes = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(PARISHES_URL);

        if (!response.ok) {
          throw new Error(`Błąd HTTP: ${response.status}`);
        }

        const data = (await response.json()) as Parish[];
        setParishes(data);
      } catch (err: unknown) {
        console.error(err);
        setError('Nie udało się pobrać listy parafii.');
      } finally {
        setLoading(false);
      }
    };

    loadParishes();
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ReCreatio</h1>
        <p style={{ color: '#555' }}>
          Podstawowa wersja – lista parafii pobrana z backendu.
        </p>
      </header>

      <section>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Parafie</h2>

        {loading && <p>Ładowanie...</p>}

        {error && (
          <p style={{ color: 'red' }}>
            {error}
          </p>
        )}

        {!loading && !error && parishes.length === 0 && (
          <p>Brak dostępnych parafii.</p>
        )}

        {!loading && !error && parishes.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {parishes.map((parish) => (
              <li
                key={parish.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <span style={{ fontWeight: 600 }}>{parish.name}</span>
                <span style={{ fontSize: '0.9rem', color: '#555' }}>{parish.city}</span>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>Slug: {parish.slug}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
