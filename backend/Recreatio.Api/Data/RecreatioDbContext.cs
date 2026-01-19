using Microsoft.EntityFrameworkCore;

namespace Recreatio.Api.Data;

public sealed class RecreatioDbContext : DbContext
{
    public RecreatioDbContext(DbContextOptions<RecreatioDbContext> options) : base(options)
    {
    }

    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RoleEdge> RoleEdges => Set<RoleEdge>();
    public DbSet<PendingRoleShare> PendingRoleShares => Set<PendingRoleShare>();
    public DbSet<KeyEntry> Keys => Set<KeyEntry>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<SharedView> SharedViews => Set<SharedView>();
    public DbSet<RoleField> RoleFields => Set<RoleField>();
    public DbSet<DataItem> DataItems => Set<DataItem>();
    public DbSet<DataKeyGrant> DataKeyGrants => Set<DataKeyGrant>();
    public DbSet<PendingDataShare> PendingDataShares => Set<PendingDataShare>();
    public DbSet<RoleRecoveryShare> RoleRecoveryShares => Set<RoleRecoveryShare>();
    public DbSet<RoleRecoveryKey> RoleRecoveryKeys => Set<RoleRecoveryKey>();
    public DbSet<RoleRecoveryRequest> RoleRecoveryRequests => Set<RoleRecoveryRequest>();
    public DbSet<RoleRecoveryApproval> RoleRecoveryApprovals => Set<RoleRecoveryApproval>();
    public DbSet<AuthLedgerEntry> AuthLedger => Set<AuthLedgerEntry>();
    public DbSet<KeyLedgerEntry> KeyLedger => Set<KeyLedgerEntry>();
    public DbSet<BusinessLedgerEntry> BusinessLedger => Set<BusinessLedgerEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserAccount>()
            .HasIndex(x => x.LoginId)
            .IsUnique();

        modelBuilder.Entity<Session>()
            .HasIndex(x => x.SessionId)
            .IsUnique();

        modelBuilder.Entity<RoleField>()
            .HasIndex(x => new { x.RoleId, x.FieldType })
            .IsUnique();

        modelBuilder.Entity<DataItem>()
            .HasIndex(x => x.OwnerRoleId);

        modelBuilder.Entity<DataKeyGrant>()
            .HasIndex(x => new { x.DataItemId, x.RoleId })
            .IsUnique();

        modelBuilder.Entity<DataKeyGrant>()
            .HasIndex(x => x.RoleId);

        modelBuilder.Entity<RoleRecoveryShare>()
            .HasIndex(x => new { x.TargetRoleId, x.SharedWithRoleId })
            .IsUnique();


        modelBuilder.Entity<RoleRecoveryApproval>()
            .HasIndex(x => new { x.RequestId, x.ApproverRoleId })
            .IsUnique();

        modelBuilder.Entity<PendingRoleShare>()
            .HasIndex(x => new { x.TargetRoleId, x.Status });

        modelBuilder.Entity<PendingDataShare>()
            .HasIndex(x => new { x.TargetRoleId, x.Status });
    }
}
