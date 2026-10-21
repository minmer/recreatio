package pl.recreatio.app;

/**
 * EINE RAMKA FÜR DIE LAMPE (2026-10-18) — was {@link LampPlugin} als BLE-Werbung
 * sendet: die Kennung des Herstellers und die Daten dahinter, wie
 * {@code AdvertiseData.Builder.addManufacturerData} sie nimmt, wie lange, und (2026-10-21)
 * in welchem Abstand die einzelnen Pakete hinausgehen ({@link #intervalMs}).
 *
 * <p>Die Seite zerlegt das Paket (`lamps/adv.ts`); hier wird nur noch einmal
 * geprüft, was ankommt. Android schreibt daraus wieder
 * {@code Länge, 0xFF, Kennung (little endian), Daten} — {@link #air()} zeigt genau das.</p>
 *
 * <p>Ohne Android-Klassen, damit es ohne Telefon prüfbar ist ({@code src/testSms}).</p>
 */
final class LampFrame {

    /** Legacy-Werbung: 31 Bytes, davon vier für Länge, Typ und Kennung. */
    static final int LEGACY_MAX = 31;
    static final int MAX_DATA = LEGACY_MAX - 4;
    static final long MIN_MS = 100;
    static final long MAX_MS = 30_000;
    static final long MAX_GAP_MS = 10_000;
    /** Ein Paket höchstens alle 100 ms — schneller lässt Android eine Legacy-Werbung nicht senden (160 × 0,625 ms). */
    static final long MIN_INTERVAL_MS = 100;
    static final long MAX_INTERVAL_MS = 10_100;
    static final int MAX_FRAMES = 20;

    final int manufacturerId;
    final byte[] data;
    final long durationMs;
    final long gapMs;
    /** Abstand zwischen zwei Paketen dieser Ramka, solange sie gesendet wird. */
    final long intervalMs;

    private LampFrame(int manufacturerId, byte[] data, long durationMs, long gapMs, long intervalMs) {
        this.manufacturerId = manufacturerId;
        this.data = data;
        this.durationMs = durationMs;
        this.gapMs = gapMs;
        this.intervalMs = intervalMs;
    }

    /** So schnell, wie Android kann (ein Paket alle {@link #MIN_INTERVAL_MS} ms). */
    static LampFrame of(int manufacturerId, String hex, long durationMs, long gapMs) {
        return of(manufacturerId, hex, durationMs, gapMs, MIN_INTERVAL_MS);
    }

    /** Geprüft — sonst {@link IllegalArgumentException} mit dem Grund (für die Seite, polnisch). */
    static LampFrame of(int manufacturerId, String hex, long durationMs, long gapMs, long intervalMs) {
        if (manufacturerId < 0 || manufacturerId > 0xFFFF) {
            throw new IllegalArgumentException("Identyfikator producenta poza zakresem 0x0000–0xFFFF.");
        }
        byte[] data = bytes(hex);
        if (data.length > MAX_DATA) {
            throw new IllegalArgumentException("Dane producenta mają " + data.length + " bajtów, mieści się najwyżej " + MAX_DATA + ".");
        }
        if (durationMs < MIN_MS || durationMs > MAX_MS) {
            throw new IllegalArgumentException("Czas nadawania od " + MIN_MS + " do " + MAX_MS + " ms.");
        }
        if (gapMs < 0 || gapMs > MAX_GAP_MS) {
            throw new IllegalArgumentException("Przerwa od 0 do " + MAX_GAP_MS + " ms.");
        }
        if (intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_INTERVAL_MS) {
            throw new IllegalArgumentException("Odstęp między pakietami od " + MIN_INTERVAL_MS + " do " + MAX_INTERVAL_MS + " ms.");
        }
        return new LampFrame(manufacturerId, data, durationMs, gapMs, intervalMs);
    }

    /** Das Intervall in den Einheiten von Android (0,625 ms), wie {@code AdvertisingSetParameters.setInterval} es nimmt. */
    int intervalUnits() {
        return (int) Math.max(160, Math.min(16_777_215L, Math.round(intervalMs / 0.625)));
    }

    /** Hex (ohne Trenner, beliebige Schreibung) → Bytes. */
    static byte[] bytes(String hex) {
        if (hex == null) throw new IllegalArgumentException("Brak danych producenta.");
        String h = hex.trim();
        if (h.length() % 2 != 0) throw new IllegalArgumentException("Nieparzysta liczba cyfr szesnastkowych.");
        byte[] out = new byte[h.length() / 2];
        for (int i = 0; i < out.length; i++) {
            int hi = Character.digit(h.charAt(2 * i), 16);
            int lo = Character.digit(h.charAt(2 * i + 1), 16);
            if (hi < 0 || lo < 0) throw new IllegalArgumentException("Niedozwolony znak w danych szesnastkowych.");
            out[i] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    /** Bytes → Hex in Grossbuchstaben (was das Telefon hört, für die Seite). */
    static String hex(byte[] bytes) {
        char[] digits = "0123456789ABCDEF".toCharArray();
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            out.append(digits[(b >> 4) & 0x0F]).append(digits[b & 0x0F]);
        }
        return out.toString();
    }

    /** Was in der Luft steht: Länge, 0xFF, Kennung (little endian), Daten — so baut Android die Struktur. */
    byte[] air() {
        byte[] out = new byte[4 + data.length];
        out[0] = (byte) (3 + data.length);
        out[1] = (byte) 0xFF;
        out[2] = (byte) (manufacturerId & 0xFF);
        out[3] = (byte) ((manufacturerId >> 8) & 0xFF);
        System.arraycopy(data, 0, out, 4, data.length);
        return out;
    }
}
