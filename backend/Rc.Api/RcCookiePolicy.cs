using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Rc.Api;

/// <summary>
/// Eine Entscheidung, zwei Cookies.
///
/// Der Browser-Teil liegt auf GitHub Pages, die API woanders. Das ist
/// seitenuebergreifend, und dafuer gibt es genau eine Kombination, die
/// Browser noch akzeptieren: <c>SameSite=None; Secure</c>. Ohne <c>Secure</c>
/// wird <c>SameSite=None</c> verworfen — nicht bemaengelt, verworfen. Das
/// Cookie kommt dann nie zurueck, und die Anfrage scheitert an einem fehlenden
/// Schutzwert, obwohl der Fehler ganz woanders liegt.
///
/// <b>Genau das ist hier passiert.</b> Das Schutzwert-Cookie stand fest auf
/// <c>Secure = true</c>. Auf einem Entwicklungsserver ohne TLS schickt der
/// Klient es nicht mit; jede geschuetzte Schreiboperation antwortet mit 403,
/// und die Meldung zeigt auf den Schutzwert statt auf das fehlende TLS. Die
/// Pruefreihe hat es gefunden, weil sie die erste war, die einen geschuetzten
/// POST wirklich abgeschickt hat.
///
/// Deshalb steht die Wahl an EINER Stelle und gilt fuer beide Cookies. Zwei
/// Cookies mit verschiedenen Regeln waeren zwei Gelegenheiten fuer denselben
/// Fehler.
/// </summary>
public sealed class RcCookiePolicy
{
    public const string ConfigKey = "Rc:CrossSiteCookies";

    /// <summary>
    /// Wahr, wenn der Browser-Teil von einem anderen Ursprung kommt als die
    /// API — der Regelfall im Betrieb. Falsch nur dort, wo beide auf demselben
    /// Ursprung liegen; dann genuegt <c>Lax</c>, und die Anwendung laeuft auch
    /// ohne TLS.
    /// </summary>
    public bool CrossSite { get; }

    public RcCookiePolicy(IConfiguration config) => CrossSite = config.GetValue(ConfigKey, true);

    public RcCookiePolicy(bool crossSite) => CrossSite = crossSite;

    public SameSiteMode SameSite => CrossSite ? SameSiteMode.None : SameSiteMode.Lax;

    /// <summary>
    /// <c>SameSite=None</c> ohne <c>Secure</c> ist ungueltig — deshalb ist
    /// <c>Always</c> im seitenuebergreifenden Fall keine Verschaerfung, sondern
    /// die Bedingung dafuer, dass es ueberhaupt funktioniert.
    /// </summary>
    public CookieSecurePolicy SecurePolicy =>
        CrossSite ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;

    public bool SecureFor(HttpRequest request) => CrossSite || request.IsHttps;
}
