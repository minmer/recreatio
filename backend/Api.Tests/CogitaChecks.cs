using Api;

/// <summary>
/// 0109 — das Spiel im Gelände rechnet der Dienst (Cogita.Game.cs): Regeln
/// prüfen, Zonen treffen, Werte im Rahmen ändern, Betreten und Verlassen,
/// „co N sekund" und „N osób w strefie" als Flanke. Reine Rechnung, ohne
/// Datenbank.
/// </summary>
internal static class CogitaChecks
{
    public static void Run(Action<bool, string> check)
    {
        var t0 = new DateTimeOffset(2026, 10, 16, 12, 0, 0, TimeSpan.Zero);
        var rynek = new Cogita.Zone("rynek", 50.0617, 19.9373, 60, null, null);
        var later = new Cogita.Zone("wawel", 50.0540, 19.9354, 80, t0.AddHours(1), null);
        var points = new Cogita.ValueDef("pts", "player", 0, 0, 10);
        var found = new Cogita.ValueDef("found", "team", 0, null, null);
        Cogita.Trigger On(string id, string on, string? zone, params Cogita.GameAction[] actions) =>
            new(id, on, zone, null, null, true, null, actions);
        var add = new Cogita.GameAction("add", "pts", 4, null, null, null);
        var rules = new Cogita.GameRules([rynek, later], [points, found], [
            On("in", "enter", "rynek", add),
            On("out", "leave", "rynek", new Cogita.GameAction("notice", null, null, null, "s9", null)),
            new("again", "enter", "rynek", null, null, false, null, [add]),
            new("crowd", "present", "rynek", 2, null, true, null, [new Cogita.GameAction("add", "found", 1, null, null, null)]),
            new("clock", "every", null, null, 60, false, null, [new Cogita.GameAction("add", "pts", 1, null, null, "each")])
        ]);

        check(Cogita.RulesProblem(rules) is null, "game: good rules pass");
        check(Cogita.RulesProblem(rules with { Triggers = [On("x", "enter", "nowhere")] }) is not null, "game: a trigger needs its zone");
        check(Cogita.RulesProblem(rules with { Triggers = [On("x", "enter", "rynek", new Cogita.GameAction("add", "gold", 1, null, null, null))] }) is not null, "game: an action needs its value");
        check(Cogita.RulesProblem(rules with { Zones = [rynek, rynek] }) is not null, "game: a zone only once");
        check(Cogita.RulesProblem(rules with { Triggers = [new("x", "every", null, null, 2, false, null, [])] }) is not null, "game: a clock at least every five seconds");
        check(Cogita.RulesProblem(rules with { Values = [new Cogita.ValueDef("v", "world", 0, null, null)] }) is not null, "game: a value is the player's, the team's or the session's");

        check(Math.Abs(Cogita.Metres(50.0617, 19.9373, 50.0540, 19.9354) - 866) < 15, "game: the distance Rynek — Wawel is about 870 m");
        check(Cogita.ZonesAt(rules, 50.0618, 19.9374, t0).SequenceEqual(["rynek"]), "game: standing on the Rynek");
        check(Cogita.ZonesAt(rules, 50.0540, 19.9354, t0).Count == 0, "game: a zone not yet open does not count");
        check(Cogita.ZonesAt(rules, 50.0540, 19.9354, t0.AddHours(2)).SequenceEqual(["wawel"]), "game: … and counts once it opens");

        var state = new Cogita.GameState();
        var entered = Cogita.Move(rules, state, "anna", "red", 50.0618, 19.9374, t0);
        check(entered.Count == 2, "game: entering fires the once and the always trigger");
        check(state.Values["player:anna"]["pts"] == 8, "game: both add four points");
        check(Cogita.Move(rules, state, "anna", "red", 50.0619, 19.9375, t0.AddSeconds(10)).Count == 0, "game: moving inside fires nothing");
        var left = Cogita.Move(rules, state, "anna", "red", 50.0700, 19.9375, t0.AddSeconds(20));
        check(left.Count == 1, "game: leaving fires the leave trigger");
        Cogita.Move(rules, state, "anna", "red", 50.0618, 19.9374, t0.AddSeconds(30));
        check(state.Values["player:anna"]["pts"] == 10, "game: back in — only the repeating trigger, and the value stops at its maximum");
        check(state.Ledger.Count == 3 && state.Ledger[^1].Before == 8 && state.Ledger[^1].After == 10, "game: every change in the ledger");

        var fresh = new HashSet<string> { "anna" };
        check(Cogita.Tick(rules, state, fresh, t0.AddSeconds(40)).Count == 1, "game: the clock fires for each fresh player");
        check(Cogita.Tick(rules, state, fresh, t0.AddSeconds(70)).Count == 0, "game: … not again before its time");
        check(Cogita.Tick(rules, state, fresh, t0.AddSeconds(101)).Count == 1, "game: … and again after a minute");

        Cogita.Move(rules, state, "bart", "red", 50.0617, 19.9373, t0.AddSeconds(110));
        fresh.Add("bart");
        var crowd = Cogita.Tick(rules, state, fresh, t0.AddSeconds(111));
        check(crowd.Count == 1 && state.Values["team:red"]["found"] == 1, "game: two of a team in the zone — the team gets its point");
        check(Cogita.Tick(rules, state, fresh, t0.AddSeconds(112)).Count == 0, "game: the crowd fires on the edge, not every tick");
        fresh.Remove("bart");
        Cogita.Tick(rules, state, fresh, t0.AddSeconds(113));
        fresh.Add("bart");
        check(Cogita.Tick(rules, state, fresh, t0.AddSeconds(114)).Count == 0, "game: a once trigger stays fired after the crowd parts and gathers again");
    }
}
