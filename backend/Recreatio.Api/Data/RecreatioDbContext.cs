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
    public DbSet<Data.Cogita.CogitaLibrary> CogitaLibraries => Set<Data.Cogita.CogitaLibrary>();
    public DbSet<Data.Cogita.CogitaInfo> CogitaInfos => Set<Data.Cogita.CogitaInfo>();
    public DbSet<Data.Cogita.CogitaLanguage> CogitaLanguages => Set<Data.Cogita.CogitaLanguage>();
    public DbSet<Data.Cogita.CogitaWord> CogitaWords => Set<Data.Cogita.CogitaWord>();
    public DbSet<Data.Cogita.CogitaSentence> CogitaSentences => Set<Data.Cogita.CogitaSentence>();
    public DbSet<Data.Cogita.CogitaTopic> CogitaTopics => Set<Data.Cogita.CogitaTopic>();
    public DbSet<Data.Cogita.CogitaPerson> CogitaPersons => Set<Data.Cogita.CogitaPerson>();
    public DbSet<Data.Cogita.CogitaAddress> CogitaAddresses => Set<Data.Cogita.CogitaAddress>();
    public DbSet<Data.Cogita.CogitaEmail> CogitaEmails => Set<Data.Cogita.CogitaEmail>();
    public DbSet<Data.Cogita.CogitaPhone> CogitaPhones => Set<Data.Cogita.CogitaPhone>();
    public DbSet<Data.Cogita.CogitaBook> CogitaBooks => Set<Data.Cogita.CogitaBook>();
    public DbSet<Data.Cogita.CogitaMedia> CogitaMedia => Set<Data.Cogita.CogitaMedia>();
    public DbSet<Data.Cogita.CogitaGeoFeature> CogitaGeoFeatures => Set<Data.Cogita.CogitaGeoFeature>();
    public DbSet<Data.Cogita.CogitaMusicPiece> CogitaMusicPieces => Set<Data.Cogita.CogitaMusicPiece>();
    public DbSet<Data.Cogita.CogitaMusicFragment> CogitaMusicFragments => Set<Data.Cogita.CogitaMusicFragment>();
    public DbSet<Data.Cogita.CogitaConnection> CogitaConnections => Set<Data.Cogita.CogitaConnection>();
    public DbSet<Data.Cogita.CogitaConnectionItem> CogitaConnectionItems => Set<Data.Cogita.CogitaConnectionItem>();
    public DbSet<Data.Cogita.CogitaGroup> CogitaGroups => Set<Data.Cogita.CogitaGroup>();
    public DbSet<Data.Cogita.CogitaGroupItem> CogitaGroupItems => Set<Data.Cogita.CogitaGroupItem>();
    public DbSet<Data.Cogita.CogitaGroupConnection> CogitaGroupConnections => Set<Data.Cogita.CogitaGroupConnection>();

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

        modelBuilder.Entity<Data.Cogita.CogitaLibrary>()
            .HasIndex(x => x.RoleId)
            .IsUnique();

        modelBuilder.Entity<Data.Cogita.CogitaInfo>()
            .HasIndex(x => new { x.LibraryId, x.InfoType });

        modelBuilder.Entity<Data.Cogita.CogitaConnectionItem>()
            .HasIndex(x => new { x.ConnectionId, x.InfoId })
            .IsUnique();

        modelBuilder.Entity<Data.Cogita.CogitaGroupItem>()
            .HasIndex(x => new { x.GroupId, x.InfoId })
            .IsUnique();

        modelBuilder.Entity<Data.Cogita.CogitaGroupConnection>()
            .HasIndex(x => new { x.GroupId, x.ConnectionId })
            .IsUnique();
    }
}
