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
    public DbSet<KeyEntryBinding> KeyEntryBindings => Set<KeyEntryBinding>();
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
    public DbSet<Data.Cogita.CogitaCollection> CogitaCollections => Set<Data.Cogita.CogitaCollection>();
    public DbSet<Data.Cogita.CogitaCollectionItem> CogitaCollectionItems => Set<Data.Cogita.CogitaCollectionItem>();
    public DbSet<Data.Cogita.CogitaCollectionGraph> CogitaCollectionGraphs => Set<Data.Cogita.CogitaCollectionGraph>();
    public DbSet<Data.Cogita.CogitaCollectionGraphNode> CogitaCollectionGraphNodes => Set<Data.Cogita.CogitaCollectionGraphNode>();
    public DbSet<Data.Cogita.CogitaCollectionGraphEdge> CogitaCollectionGraphEdges => Set<Data.Cogita.CogitaCollectionGraphEdge>();
    public DbSet<Data.Cogita.CogitaWordLanguage> CogitaWordLanguages => Set<Data.Cogita.CogitaWordLanguage>();
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
            .HasIndex(x => new { x.RoleId, x.FieldTypeHash })
            .IsUnique();

        modelBuilder.Entity<DataItem>()
            .HasIndex(x => x.OwnerRoleId);

        modelBuilder.Entity<KeyEntry>()
            .HasIndex(x => x.OwnerRoleId);

        modelBuilder.Entity<KeyEntryBinding>()
            .HasIndex(x => x.KeyEntryId);
        modelBuilder.Entity<KeyEntryBinding>()
            .HasIndex(x => x.EntryId);
        modelBuilder.Entity<KeyEntryBinding>()
            .HasOne<KeyEntry>()
            .WithMany()
            .HasForeignKey(x => x.KeyEntryId);

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

        modelBuilder.Entity<Data.Cogita.CogitaWordLanguage>()
            .HasKey(x => new { x.LanguageInfoId, x.WordInfoId });
        modelBuilder.Entity<Data.Cogita.CogitaWordLanguage>()
            .HasIndex(x => x.WordInfoId);

        modelBuilder.Entity<Data.Cogita.CogitaInfo>()
            .HasIndex(x => new { x.LibraryId, x.InfoType });
        modelBuilder.Entity<Data.Cogita.CogitaInfo>()
            .HasIndex(x => new { x.LibraryId, x.InfoType, x.CreatedUtc, x.Id });

        modelBuilder.Entity<Data.Cogita.CogitaConnectionItem>()
            .HasIndex(x => new { x.ConnectionId, x.InfoId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaConnection>()
            .HasIndex(x => new { x.LibraryId, x.ConnectionType, x.CreatedUtc, x.Id });

        modelBuilder.Entity<Data.Cogita.CogitaCollectionItem>()
            .HasIndex(x => new { x.CollectionInfoId, x.ItemType, x.ItemId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaCollectionItem>()
            .HasIndex(x => new { x.CollectionInfoId, x.SortOrder });

        modelBuilder.Entity<Data.Cogita.CogitaCollectionGraph>()
            .HasIndex(x => x.CollectionInfoId)
            .IsUnique();

        modelBuilder.Entity<Data.Cogita.CogitaCollectionGraphNode>()
            .HasIndex(x => x.GraphId);

        modelBuilder.Entity<Data.Cogita.CogitaCollectionGraphEdge>()
            .HasIndex(x => x.GraphId);

        modelBuilder.Entity<Data.Cogita.CogitaCollection>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);

        modelBuilder.Entity<Data.Cogita.CogitaLibrary>()
            .HasOne<Role>()
            .WithMany()
            .HasForeignKey(x => x.RoleId);

        modelBuilder.Entity<Data.Cogita.CogitaInfo>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);

        modelBuilder.Entity<Data.Cogita.CogitaLanguage>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaWord>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaSentence>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaTopic>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaPerson>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaAddress>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaEmail>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaPhone>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaBook>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaMedia>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaGeoFeature>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaMusicPiece>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaMusicFragment>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);

        modelBuilder.Entity<Data.Cogita.CogitaWordLanguage>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.LanguageInfoId);
        modelBuilder.Entity<Data.Cogita.CogitaWordLanguage>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.WordInfoId);

        modelBuilder.Entity<Data.Cogita.CogitaConnection>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);
        modelBuilder.Entity<Data.Cogita.CogitaConnectionItem>()
            .HasOne<Data.Cogita.CogitaConnection>()
            .WithMany()
            .HasForeignKey(x => x.ConnectionId);
        modelBuilder.Entity<Data.Cogita.CogitaConnectionItem>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);

        modelBuilder.Entity<Data.Cogita.CogitaCollectionItem>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.CollectionInfoId);

        modelBuilder.Entity<Data.Cogita.CogitaCollectionGraph>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.CollectionInfoId);

        modelBuilder.Entity<Data.Cogita.CogitaCollectionGraphNode>()
            .HasOne<Data.Cogita.CogitaCollectionGraph>()
            .WithMany()
            .HasForeignKey(x => x.GraphId);

        modelBuilder.Entity<Data.Cogita.CogitaCollectionGraphEdge>()
            .HasOne<Data.Cogita.CogitaCollectionGraph>()
            .WithMany()
            .HasForeignKey(x => x.GraphId);

        modelBuilder.Entity<Data.Cogita.CogitaGroup>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);
        modelBuilder.Entity<Data.Cogita.CogitaGroupItem>()
            .HasOne<Data.Cogita.CogitaGroup>()
            .WithMany()
            .HasForeignKey(x => x.GroupId);
        modelBuilder.Entity<Data.Cogita.CogitaGroupItem>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaGroupConnection>()
            .HasOne<Data.Cogita.CogitaGroup>()
            .WithMany()
            .HasForeignKey(x => x.GroupId);
        modelBuilder.Entity<Data.Cogita.CogitaGroupConnection>()
            .HasOne<Data.Cogita.CogitaConnection>()
            .WithMany()
            .HasForeignKey(x => x.ConnectionId);

        modelBuilder.Entity<Data.Cogita.CogitaGroupItem>()
            .HasIndex(x => new { x.GroupId, x.InfoId })
            .IsUnique();

        modelBuilder.Entity<Data.Cogita.CogitaGroupConnection>()
            .HasIndex(x => new { x.GroupId, x.ConnectionId })
            .IsUnique();
    }
}
