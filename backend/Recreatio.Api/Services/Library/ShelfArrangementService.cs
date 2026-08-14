namespace Recreatio.Api.Services.Library;

/// <summary>One book to be placed, with the dimensions that decide where it fits.</summary>
public sealed record ArrangementCandidate(
    long ItemId,
    string Title,
    string? Signature,
    long? PlacementGroupId,
    string GroupKind,
    string? GroupName,
    int? SeriesPosition,
    int? HeightMm,
    int? WidthMm,
    int? DepthMm
);

public sealed record ArrangementShelf(
    long ShelfId,
    string Name,
    int SortOrder,
    int? HeightMm,
    int? DepthMm,
    int? WidthMm
);

public sealed record ArrangementPlacement(
    long ItemId,
    string Title,
    long ShelfId,
    int Position,
    long? PreviousItemId,
    long? NextItemId,
    string? GroupName
);

/// <summary>A book the heuristic could not place, and the reason.</summary>
public sealed record ArrangementUnplaced(long ItemId, string Title, string Reason);

public sealed record ArrangementProposal(
    IReadOnlyList<ArrangementPlacement> Placements,
    IReadOnlyList<ArrangementUnplaced> Unplaced,
    IReadOnlyList<string> Notes
);

public interface IShelfArrangementService
{
    /// <summary>
    /// Proposes an arrangement. Never writes anything — the result is a
    /// suggestion for review.
    /// </summary>
    ArrangementProposal Propose(IReadOnlyList<ArrangementShelf> shelves, IReadOnlyList<ArrangementCandidate> items);
}

/// <summary>
/// A deliberately simple packer: tallest-first placement into the shortest shelf
/// that still fits, keeping groups together and series in order.
///
/// This is not an optimiser and does not try to be. It aims to produce an
/// arrangement a person would recognise as sensible, and to say plainly which
/// books it could not place and why.
/// </summary>
public sealed class ShelfArrangementService : IShelfArrangementService
{
    /// <summary>Spine width assumed when a manifestation has no measurements.</summary>
    private const int DefaultWidthMm = 25;

    public ArrangementProposal Propose(
        IReadOnlyList<ArrangementShelf> shelves,
        IReadOnlyList<ArrangementCandidate> items)
    {
        var notes = new List<string>();
        var unplaced = new List<ArrangementUnplaced>();
        var placements = new List<ArrangementPlacement>();

        if (shelves.Count == 0)
        {
            return new ArrangementProposal([], items.Select(x =>
                new ArrangementUnplaced(x.ItemId, x.Title, "no shelves defined")).ToList(),
                ["Define at least one shelf with a height before asking for an arrangement."]);
        }

        // Books travel as blocks: a series or collection is placed whole, so it
        // never ends up split across two shelves.
        var blocks = BuildBlocks(items, notes);

        var remainingWidth = shelves.ToDictionary(x => x.ShelfId, x => x.WidthMm ?? int.MaxValue);
        var contents = shelves.ToDictionary(x => x.ShelfId, _ => new List<ArrangementCandidate>());

        // Tallest blocks first: they are the hardest to place, and placing them
        // late is what strands them.
        foreach (var block in blocks.OrderByDescending(b => b.MaxHeightMm).ThenBy(b => b.Name, StringComparer.CurrentCulture))
        {
            var shelf = shelves
                .Where(candidate => Fits(candidate, block, remainingWidth[candidate.ShelfId]))
                // Shortest adequate shelf, so tall shelves stay free for tall books.
                .OrderBy(candidate => candidate.HeightMm ?? int.MaxValue)
                .ThenBy(candidate => candidate.SortOrder)
                .FirstOrDefault();

            if (shelf is null)
            {
                var reason = DescribeFailure(shelves, block);
                foreach (var item in block.Items) unplaced.Add(new ArrangementUnplaced(item.ItemId, item.Title, reason));
                continue;
            }

            contents[shelf.ShelfId].AddRange(block.Items);
            if (remainingWidth[shelf.ShelfId] != int.MaxValue)
            {
                remainingWidth[shelf.ShelfId] -= block.TotalWidthMm;
            }
        }

        foreach (var shelf in shelves.OrderBy(x => x.SortOrder))
        {
            var placed = contents[shelf.ShelfId];
            for (var index = 0; index < placed.Count; index++)
            {
                placements.Add(new ArrangementPlacement(
                    placed[index].ItemId,
                    placed[index].Title,
                    shelf.ShelfId,
                    index,
                    index > 0 ? placed[index - 1].ItemId : null,
                    index < placed.Count - 1 ? placed[index + 1].ItemId : null,
                    placed[index].GroupName));
            }
        }

        if (unplaced.Count > 0)
        {
            notes.Add($"{unplaced.Count} book(s) could not be placed. Each is listed with its reason.");
        }

        var unmeasured = items.Count(x => x.HeightMm is null);
        if (unmeasured > 0)
        {
            notes.Add($"{unmeasured} book(s) have no height recorded and were treated as fitting anywhere.");
        }

        return new ArrangementProposal(placements, unplaced, notes);
    }

    // ── Blocks ──────────────────────────────────────────────────────────────

    private sealed record Block(
        string Name,
        List<ArrangementCandidate> Items,
        int MaxHeightMm,
        int MaxDepthMm,
        int TotalWidthMm
    );

    /// <summary>
    /// Groups items into indivisible blocks. A series keeps its numbering; a
    /// collection stays adjacent but is ordered by title; a free book is its own
    /// block of one.
    /// </summary>
    private static List<Block> BuildBlocks(IReadOnlyList<ArrangementCandidate> items, List<string> notes)
    {
        var blocks = new List<Block>();

        var grouped = items
            .Where(x => x.PlacementGroupId is not null && x.GroupKind != "free")
            .GroupBy(x => x.PlacementGroupId!.Value);

        foreach (var group in grouped)
        {
            var members = group.ToList();
            var kind = members[0].GroupKind;
            var name = members[0].GroupName ?? $"group {group.Key}";

            var ordered = kind == "series"
                ? members
                    .OrderBy(x => x.SeriesPosition is null)
                    .ThenBy(x => x.SeriesPosition)
                    .ThenBy(x => x.Title, StringComparer.CurrentCulture)
                    .ToList()
                : members.OrderBy(x => x.Title, StringComparer.CurrentCulture).ToList();

            if (kind == "series" && ordered.Any(x => x.SeriesPosition is null))
            {
                notes.Add($"“{name}” is an ordered series but some volumes have no number; those were sorted by title.");
            }

            blocks.Add(ToBlock(name, ordered));
        }

        foreach (var loose in items.Where(x => x.PlacementGroupId is null || x.GroupKind == "free"))
        {
            blocks.Add(ToBlock(loose.Title, [loose]));
        }

        return blocks;
    }

    private static Block ToBlock(string name, List<ArrangementCandidate> items) =>
        new(name,
            items,
            items.Max(x => x.HeightMm ?? 0),
            items.Max(x => x.DepthMm ?? 0),
            items.Sum(x => x.WidthMm ?? DefaultWidthMm));

    // ── Fit ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// An unmeasured shelf or book is treated as unconstrained: a guess would be
    /// worse than admitting the measurement is missing.
    /// </summary>
    private static bool Fits(ArrangementShelf shelf, Block block, int remainingWidth)
    {
        if (shelf.HeightMm is { } height && block.MaxHeightMm > height) return false;
        if (shelf.DepthMm is { } depth && block.MaxDepthMm > depth) return false;
        if (remainingWidth != int.MaxValue && block.TotalWidthMm > remainingWidth) return false;
        return true;
    }

    private static string DescribeFailure(IReadOnlyList<ArrangementShelf> shelves, Block block)
    {
        var tallEnough = shelves.Where(x => x.HeightMm is null || block.MaxHeightMm <= x.HeightMm).ToList();
        if (tallEnough.Count == 0)
        {
            var tallest = shelves.Max(x => x.HeightMm ?? 0);
            return $"needs {block.MaxHeightMm} mm of height; the tallest shelf is {tallest} mm";
        }

        var deepEnough = tallEnough.Where(x => x.DepthMm is null || block.MaxDepthMm <= x.DepthMm).ToList();
        if (deepEnough.Count == 0)
        {
            return $"needs {block.MaxDepthMm} mm of depth; no shelf is that deep";
        }

        return block.Items.Count > 1
            ? $"the group needs {block.TotalWidthMm} mm of contiguous width; no shelf has that much left"
            : $"needs {block.TotalWidthMm} mm of width; no shelf has that much left";
    }
}
