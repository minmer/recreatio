using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Rc.Api;

/// <summary>
/// Eine Stelle, an der die Verbindung zur Datenbank entsteht.
///
/// <para>
/// <b>Dieselbe Datenbank wie der Altbestand — getrennt wird ueber den
/// Tabellennamen.</b> Jede Tabelle des Neuaufbaus traegt das Praefix
/// <c>rc_</c>: alle neunundfuenfzig, ohne Ausnahme. Keine Tabelle des
/// Altbestands beginnt so. Die beiden Teile koennen sich also nicht in die
/// Quere kommen, obwohl sie nebeneinander liegen.
/// </para>
///
/// <para>
/// <b>Warum das die bessere Trennung ist als zwei Datenbanken.</b> Zwei
/// Datenbanken heissen: zwei Zeichenfolgen, zwei Sicherungen, zwei
/// Wiederherstellungen, zwei Rechtevergaben — und zwei Gelegenheiten, beim
/// naechsten Umzug eine davon zu vergessen. Der Preis dafuer waere hier nicht
/// einmal ein Gewinn: was zu trennen ist, sind die TABELLEN, und das erledigt
/// das Praefix vollstaendig.
/// </para>
///
/// <para>
/// Diese Klasse bleibt trotzdem der einzige Weg zur Datenbank. Wenn jeder
/// Endpunkt die Zeichenfolge selbst aus der Konfiguration liest, ist das
/// solange richtig, bis einer den falschen Schluessel nimmt.
/// </para>
///
/// <para>
/// <b>Zwei Wege hinein, und der zweite ist der Regelfall.</b>
/// </para>
///
/// <list type="number">
/// <item><c>Rc:ConnectionString</c> — ausdruecklich gesetzt, gewinnt immer.
/// Fuer den Fall, dass der Neuaufbau doch einmal woanders liegen soll.</item>
/// <item>Sonst dieselbe wie der Altbestand
/// (<c>ConnectionStrings:DefaultConnection</c>).</item>
/// </list>
///
/// <para>
/// Der zweite Weg ist der Grund, warum ein Betrieb, der den Altbestand schon
/// eingerichtet hat, fuer den Neuaufbau nichts weiter einzurichten braucht.
/// Server, Anmeldedaten und Datenbank stehen dort ohnehin; sie ein zweites Mal
/// zu hinterlegen hiesse, dieselbe Wahrheit an zwei Stellen zu pflegen — und
/// beim naechsten Passwortwechsel eine davon zu vergessen.
/// </para>
///
/// <para>
/// <b>Was dabei nicht vergessen werden darf:</b> die Migrationen des
/// Neuaufbaus muessen gegen genau diese Datenbank gelaufen sein. Sonst steht
/// die Zeichenfolge, die Verbindung kommt zustande — und die erste Anfrage
/// findet <c>dbo.rc_account</c> nicht. <c>/rc/health</c> meldet das als
/// „Schemafassung".
/// </para>
/// </summary>
public sealed class RcDb
{
    public const string ConfigKey = "Rc:ConnectionString";

    /// <summary>Die Zeichenfolge des Altbestands. Dieselbe Datenbank.</summary>
    public const string FallbackKey = "ConnectionStrings:DefaultConnection";

    private readonly string _connectionString;

    public RcDb(IConfiguration config) =>
        _connectionString = Resolve(config) ?? throw new InvalidOperationException(
            $"Weder {ConfigKey} noch {FallbackKey} ist gesetzt. "
            + "Ohne eine davon kann die Plattform nichts speichern.");

    public async Task<SqlConnection> OpenAsync(CancellationToken ct = default)
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(ct);
        return connection;
    }

    /// <summary>
    /// Fuer die Bereitschaftspruefung und die Sitzungspruefung: die duerfen
    /// nicht beim Start abstuerzen, nur weil noch nichts eingerichtet ist.
    /// </summary>
    public static string? TryRead(IConfiguration config) => Resolve(config);

    /// <summary>
    /// Die Zeichenfolge bestimmen: der eigene Schluessel, sonst der des
    /// Altbestands.
    /// </summary>
    /// <returns><c>null</c>, wenn beide fehlen.</returns>
    public static string? Resolve(IConfiguration config)
    {
        var explicitly = config[ConfigKey];
        if (!string.IsNullOrWhiteSpace(explicitly)) return explicitly;

        var shared = config[FallbackKey];
        return string.IsNullOrWhiteSpace(shared) ? null : shared;
    }
}
