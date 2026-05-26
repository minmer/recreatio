namespace Recreatio.Api.Data.Cg;

public class CgFieldDef
{
    public long Id { get; set; }
    public long TypeDefId { get; set; }
    public string Label { get; set; } = "";
    public int SortOrder { get; set; }
    // text | number | date | reference | file
    public string InputType { get; set; } = "text";
    // Comma-separated allowed file categories: image,audio,video,document — null/empty = any
    public string? FileTypes { get; set; }
    public bool Multiple { get; set; }
    public bool IsOrdered { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
