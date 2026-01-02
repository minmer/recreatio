using System.ComponentModel.DataAnnotations;

namespace Recreatio.Api.Data;

public sealed class RoleEdge
{
    [Key]
    public Guid Id { get; set; }

    public Guid ParentRoleId { get; set; }

    public Guid ChildRoleId { get; set; }

    [MaxLength(64)]
    public string RelationshipType { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }
}
