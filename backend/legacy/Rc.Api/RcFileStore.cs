using Microsoft.Extensions.Configuration;

namespace Rc.Api;

/// <summary>
/// Wo die verschluesselten Anhaenge liegen — und wogegen ein relativer Pfad
/// aufgeloest wird.
///
/// <para>
/// <b>Das Problem, das diese Klasse loest, faellt nicht auf.</b> Ein relativer
/// Pfad wie <c>..\data\rc-file-store</c> ist fuer sich genommen keine Angabe:
/// er haengt daran, was das Betriebssystem gerade fuer das aktuelle Verzeichnis
/// haelt. Unter IIS ist das nicht zuverlaessig das Anwendungsverzeichnis, und
/// bei einem Dienst schon gar nicht.
/// </para>
///
/// <para>
/// Das Unangenehme daran ist nicht der Fehlschlag, sondern der Erfolg an der
/// falschen Stelle: <c>Directory.CreateDirectory</c> legt den Ordner dann
/// einfach woanders an, die Bereitschaftspruefung schreibt ihre Probe hinein
/// und meldet gruen. Erst Monate spaeter sucht jemand die Anhaenge und findet
/// einen leeren Ordner an der Stelle, wo er sie vermutet hat.
/// </para>
///
/// <para>
/// Aufgeloest wird deshalb gegen <see cref="AppContext.BaseDirectory"/> — das
/// Verzeichnis, in dem die Anwendung wirklich liegt. Auf einem geteilten
/// Hoster ist das der veroeffentlichte Ordner (dort <c>wwwroot</c>), und
/// <c>..\data\rc-file-store</c> heisst dann genau das, wonach es aussieht:
/// der Ordner <c>data</c> NEBEN dem veroeffentlichten — ausserhalb dessen, was
/// eine Veroeffentlichung ueberschreibt, und ausserhalb dessen, was der
/// Webserver ausliefert.
/// </para>
///
/// <para>
/// Ein absoluter Pfad bleibt unveraendert. Wer einen angibt, meint ihn.
/// </para>
/// </summary>
public static class RcFileStore
{
    public const string ConfigKey = "Rc:FileStorePath";

    /// <summary>Der Wurzelordner, immer absolut.</summary>
    /// <exception cref="InvalidOperationException">Wenn nichts eingestellt ist.</exception>
    public static string Root(IConfiguration config) =>
        TryRoot(config) ?? throw new InvalidOperationException($"{ConfigKey} fehlt.");

    /// <summary>
    /// Fuer die Bereitschaftspruefung: die darf nicht werfen, sondern muss
    /// berichten.
    /// </summary>
    public static string? TryRoot(IConfiguration config)
    {
        var path = config[ConfigKey];
        if (string.IsNullOrWhiteSpace(path)) return null;

        // Path.GetFullPath mit Basis loest auch "..\" auf und macht aus einer
        // Angabe, die von der Laufumgebung abhaengt, eine, die es nicht tut.
        return Path.GetFullPath(path, AppContext.BaseDirectory);
    }
}
