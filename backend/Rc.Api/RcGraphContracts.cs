namespace Rc.Api;

/* ---------------------------------------------------------------------------
   Antworten des Wissensgraphen.
   --------------------------------------------------------------------------- */

public sealed record RcLibraryCreatedResponse(string LibraryId, string Slug, string Title, bool IsPublic);

public sealed record RcLibrariesResponse(IReadOnlyList<RcGraph.LibrarySummary> Libraries);

/// <summary>
/// <c>isPublic</c> steht mit in der Antwort, weil die Oberflaeche daran zwei
/// Dinge festmacht: ob sie einen Hinweis auf Klartext zeigt, und ob sie die
/// Suche dem Server ueberlaesst oder selbst uebernimmt.
/// </summary>
public sealed record RcNodesResponse(IReadOnlyList<RcGraph.NodeView> Nodes, bool IsPublic);

public sealed record RcNodeCreatedResponse(string NodeId, string Kind);

public sealed record RcEdgeCreatedResponse(string EdgeId, string State);

/// <summary>
/// <c>serverSide</c> ist der wichtigste Teil dieser Antwort.
///
/// <c>false</c> heisst NICHT "nichts gefunden", sondern "hier kann ich nicht
/// suchen — die Werte liegen versiegelt". Ohne dieses Feld saehen beide Faelle
/// gleich aus, und die Oberflaeche meldete eine leere Trefferliste, wo sie in
/// Wahrheit selbst suchen muesste.
/// </summary>
public sealed record RcGraphSearchResponse(IReadOnlyList<RcGraph.SearchHit> Hits, bool ServerSide);

/// <summary>
/// §1.6a — Die Abschnitte eines Bereichsknotens, in ihrer Reihenfolge.
///
/// Ein Koenig, der 992–1000 und wieder 1002–1025 regierte, hat EINE
/// Regierung mit zwei Abschnitten. Sie in zwei Kanten zu zerlegen hiesse,
/// zwei Regierungen zu behaupten — und genau das soll dieses Modell
/// verhindern.
/// </summary>
public sealed record RcRangeSegmentsResponse(
    string NodeId, IReadOnlyList<RcGraph.SegmentView> Segments);

public sealed record RcRangeSegmentsSetResponse(string NodeId, int Segments);
