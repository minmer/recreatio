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
    public DbSet<Data.Parish.Parish> Parishes => Set<Data.Parish.Parish>();
    public DbSet<Data.Parish.ParishSiteConfig> ParishSiteConfigs => Set<Data.Parish.ParishSiteConfig>();
    public DbSet<Data.Parish.ParishLedgerEntry> ParishLedger => Set<Data.Parish.ParishLedgerEntry>();
    public DbSet<Data.Parish.ParishIntention> ParishIntentions => Set<Data.Parish.ParishIntention>();
    public DbSet<Data.Parish.ParishOffering> ParishOfferings => Set<Data.Parish.ParishOffering>();
    public DbSet<Data.Parish.ParishMass> ParishMasses => Set<Data.Parish.ParishMass>();
    public DbSet<Data.Parish.ParishMassRule> ParishMassRules => Set<Data.Parish.ParishMassRule>();
    public DbSet<Data.Cogita.CogitaLibrary> CogitaLibraries => Set<Data.Cogita.CogitaLibrary>();
    public DbSet<Data.Cogita.CogitaInfo> CogitaInfos => Set<Data.Cogita.CogitaInfo>();
    public DbSet<Data.Cogita.CogitaLanguage> CogitaLanguages => Set<Data.Cogita.CogitaLanguage>();
    public DbSet<Data.Cogita.CogitaWord> CogitaWords => Set<Data.Cogita.CogitaWord>();
    public DbSet<Data.Cogita.CogitaSentence> CogitaSentences => Set<Data.Cogita.CogitaSentence>();
    public DbSet<Data.Cogita.CogitaTopic> CogitaTopics => Set<Data.Cogita.CogitaTopic>();
    public DbSet<Data.Cogita.CogitaPerson> CogitaPersons => Set<Data.Cogita.CogitaPerson>();
    public DbSet<Data.Cogita.CogitaInstitution> CogitaInstitutions => Set<Data.Cogita.CogitaInstitution>();
    public DbSet<Data.Cogita.CogitaCollective> CogitaCollectives => Set<Data.Cogita.CogitaCollective>();
    public DbSet<Data.Cogita.CogitaOrcid> CogitaOrcids => Set<Data.Cogita.CogitaOrcid>();
    public DbSet<Data.Cogita.CogitaAddress> CogitaAddresses => Set<Data.Cogita.CogitaAddress>();
    public DbSet<Data.Cogita.CogitaEmail> CogitaEmails => Set<Data.Cogita.CogitaEmail>();
    public DbSet<Data.Cogita.CogitaPhone> CogitaPhones => Set<Data.Cogita.CogitaPhone>();
    public DbSet<Data.Cogita.CogitaMedia> CogitaMedia => Set<Data.Cogita.CogitaMedia>();
    public DbSet<Data.Cogita.CogitaWork> CogitaWorks => Set<Data.Cogita.CogitaWork>();
    public DbSet<Data.Cogita.CogitaGeoFeature> CogitaGeoFeatures => Set<Data.Cogita.CogitaGeoFeature>();
    public DbSet<Data.Cogita.CogitaMusicPiece> CogitaMusicPieces => Set<Data.Cogita.CogitaMusicPiece>();
    public DbSet<Data.Cogita.CogitaMusicFragment> CogitaMusicFragments => Set<Data.Cogita.CogitaMusicFragment>();
    public DbSet<Data.Cogita.CogitaSource> CogitaSources => Set<Data.Cogita.CogitaSource>();
    public DbSet<Data.Cogita.CogitaQuote> CogitaQuotes => Set<Data.Cogita.CogitaQuote>();
    public DbSet<Data.Cogita.CogitaComputedInfo> CogitaComputedInfos => Set<Data.Cogita.CogitaComputedInfo>();
    public DbSet<Data.Cogita.CogitaCollection> CogitaCollections => Set<Data.Cogita.CogitaCollection>();
    public DbSet<Data.Cogita.CogitaCollectionItem> CogitaCollectionItems => Set<Data.Cogita.CogitaCollectionItem>();
    public DbSet<Data.Cogita.CogitaCollectionDependency> CogitaCollectionDependencies => Set<Data.Cogita.CogitaCollectionDependency>();
    public DbSet<Data.Cogita.CogitaCollectionGraph> CogitaCollectionGraphs => Set<Data.Cogita.CogitaCollectionGraph>();
    public DbSet<Data.Cogita.CogitaCollectionGraphNode> CogitaCollectionGraphNodes => Set<Data.Cogita.CogitaCollectionGraphNode>();
    public DbSet<Data.Cogita.CogitaCollectionGraphEdge> CogitaCollectionGraphEdges => Set<Data.Cogita.CogitaCollectionGraphEdge>();
    public DbSet<Data.Cogita.CogitaDependencyGraph> CogitaDependencyGraphs => Set<Data.Cogita.CogitaDependencyGraph>();
    public DbSet<Data.Cogita.CogitaDependencyGraphNode> CogitaDependencyGraphNodes => Set<Data.Cogita.CogitaDependencyGraphNode>();
    public DbSet<Data.Cogita.CogitaDependencyGraphEdge> CogitaDependencyGraphEdges => Set<Data.Cogita.CogitaDependencyGraphEdge>();
    public DbSet<Data.Cogita.CogitaWordLanguage> CogitaWordLanguages => Set<Data.Cogita.CogitaWordLanguage>();
    public DbSet<Data.Cogita.CogitaConnection> CogitaConnections => Set<Data.Cogita.CogitaConnection>();
    public DbSet<Data.Cogita.CogitaConnectionItem> CogitaConnectionItems => Set<Data.Cogita.CogitaConnectionItem>();
    public DbSet<Data.Cogita.CogitaInfoLinkSingle> CogitaInfoLinkSingles => Set<Data.Cogita.CogitaInfoLinkSingle>();
    public DbSet<Data.Cogita.CogitaInfoLinkMulti> CogitaInfoLinkMultis => Set<Data.Cogita.CogitaInfoLinkMulti>();
    public DbSet<Data.Cogita.CogitaInfoSearchIndex> CogitaInfoSearchIndexes => Set<Data.Cogita.CogitaInfoSearchIndex>();
    public DbSet<Data.Cogita.CogitaEntitySearchDocument> CogitaEntitySearchDocuments => Set<Data.Cogita.CogitaEntitySearchDocument>();
    public DbSet<Data.Cogita.CogitaGroup> CogitaGroups => Set<Data.Cogita.CogitaGroup>();
    public DbSet<Data.Cogita.CogitaGroupItem> CogitaGroupItems => Set<Data.Cogita.CogitaGroupItem>();
    public DbSet<Data.Cogita.CogitaGroupConnection> CogitaGroupConnections => Set<Data.Cogita.CogitaGroupConnection>();
    public DbSet<Data.Cogita.CogitaReviewEvent> CogitaReviewEvents => Set<Data.Cogita.CogitaReviewEvent>();
    public DbSet<Data.Cogita.CogitaReviewOutcome> CogitaReviewOutcomes => Set<Data.Cogita.CogitaReviewOutcome>();
    public DbSet<Data.Cogita.CogitaRevision> CogitaRevisions => Set<Data.Cogita.CogitaRevision>();
    public DbSet<Data.Cogita.CogitaRevisionShare> CogitaRevisionShares => Set<Data.Cogita.CogitaRevisionShare>();
    public DbSet<Data.Cogita.CogitaItemDependency> CogitaItemDependencies => Set<Data.Cogita.CogitaItemDependency>();

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

        modelBuilder.Entity<Data.Parish.Parish>()
            .HasIndex(x => x.Slug)
            .IsUnique();

        modelBuilder.Entity<Data.Parish.ParishSiteConfig>()
            .HasIndex(x => x.ParishId)
            .IsUnique();

        modelBuilder.Entity<Data.Parish.ParishLedgerEntry>()
            .HasIndex(x => x.ParishId);

        modelBuilder.Entity<Data.Parish.ParishIntention>()
            .HasIndex(x => new { x.ParishId, x.MassDateTime });

        modelBuilder.Entity<Data.Parish.ParishOffering>()
            .HasIndex(x => x.ParishId);

        modelBuilder.Entity<Data.Parish.ParishMass>()
            .HasIndex(x => new { x.ParishId, x.MassDateTime });

        modelBuilder.Entity<Data.Parish.ParishMassRule>()
            .HasIndex(x => new { x.ParishId, x.Name });

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
        modelBuilder.Entity<Data.Cogita.CogitaInfoLinkSingle>()
            .Property(x => x.FieldKey)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaInfoLinkSingle>()
            .HasIndex(x => new { x.LibraryId, x.InfoId, x.FieldKey })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaInfoLinkSingle>()
            .HasIndex(x => new { x.LibraryId, x.FieldKey, x.TargetInfoId });
        modelBuilder.Entity<Data.Cogita.CogitaInfoLinkMulti>()
            .Property(x => x.FieldKey)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaInfoLinkMulti>()
            .HasIndex(x => new { x.LibraryId, x.InfoId, x.FieldKey, x.TargetInfoId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaInfoLinkMulti>()
            .HasIndex(x => new { x.LibraryId, x.FieldKey, x.TargetInfoId });
        modelBuilder.Entity<Data.Cogita.CogitaConnection>()
            .HasIndex(x => new { x.LibraryId, x.ConnectionType, x.CreatedUtc, x.Id });
        modelBuilder.Entity<Data.Cogita.CogitaInfoSearchIndex>()
            .Property(x => x.LabelNormalized)
            .HasMaxLength(256);
        modelBuilder.Entity<Data.Cogita.CogitaInfoSearchIndex>()
            .HasIndex(x => new { x.LibraryId, x.InfoType, x.LabelNormalized });
        modelBuilder.Entity<Data.Cogita.CogitaInfoSearchIndex>()
            .HasIndex(x => new { x.LibraryId, x.InfoId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaEntitySearchDocument>()
            .Property(x => x.TitleNormalized)
            .HasMaxLength(256);
        modelBuilder.Entity<Data.Cogita.CogitaEntitySearchDocument>()
            .HasIndex(x => new { x.LibraryId, x.EntityType, x.TitleNormalized });
        modelBuilder.Entity<Data.Cogita.CogitaEntitySearchDocument>()
            .HasIndex(x => new { x.LibraryId, x.SourceKind, x.SourceId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaEntitySearchDocument>()
            .HasIndex(x => new { x.LibraryId, x.SourceUpdatedUtc });

        modelBuilder.Entity<Data.Cogita.CogitaCollectionItem>()
            .HasIndex(x => new { x.CollectionInfoId, x.ItemType, x.ItemId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaCollectionItem>()
            .HasIndex(x => new { x.CollectionInfoId, x.SortOrder });

        modelBuilder.Entity<Data.Cogita.CogitaCollectionGraph>()
            .HasIndex(x => x.CollectionInfoId)
            .IsUnique();

        modelBuilder.Entity<Data.Cogita.CogitaRevision>()
            .HasIndex(x => new { x.LibraryId, x.CollectionId, x.CreatedUtc, x.Id });
        modelBuilder.Entity<Data.Cogita.CogitaRevision>()
            .HasIndex(x => new { x.CollectionId, x.Name });

        modelBuilder.Entity<Data.Cogita.CogitaRevisionShare>()
            .HasIndex(x => new { x.LibraryId, x.RevokedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaRevisionShare>()
            .HasIndex(x => x.PublicCodeHash);

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
        modelBuilder.Entity<Data.Cogita.CogitaInstitution>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaCollective>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaOrcid>()
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
        modelBuilder.Entity<Data.Cogita.CogitaMedia>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaWork>()
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
        modelBuilder.Entity<Data.Cogita.CogitaSource>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaQuote>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaComputedInfo>()
            .HasKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaComputedInfo>()
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
        modelBuilder.Entity<Data.Cogita.CogitaCollectionDependency>()
            .HasIndex(x => new { x.ParentCollectionInfoId, x.ChildCollectionInfoId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaCollectionDependency>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.ParentCollectionInfoId);
        modelBuilder.Entity<Data.Cogita.CogitaCollectionDependency>()
            .HasOne<Data.Cogita.CogitaInfo>()
            .WithMany()
            .HasForeignKey(x => x.ChildCollectionInfoId);

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

        modelBuilder.Entity<Data.Cogita.CogitaDependencyGraph>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);

        modelBuilder.Entity<Data.Cogita.CogitaDependencyGraphNode>()
            .HasOne<Data.Cogita.CogitaDependencyGraph>()
            .WithMany()
            .HasForeignKey(x => x.GraphId);

        modelBuilder.Entity<Data.Cogita.CogitaDependencyGraphEdge>()
            .HasOne<Data.Cogita.CogitaDependencyGraph>()
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

        modelBuilder.Entity<Data.Cogita.CogitaReviewEvent>()
            .HasIndex(x => new { x.PersonRoleId, x.ItemType, x.ItemId, x.CreatedUtc });

        modelBuilder.Entity<Data.Cogita.CogitaReviewOutcome>()
            .HasIndex(x => new { x.PersonRoleId, x.ItemType, x.ItemId, x.CheckType, x.Direction, x.CreatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaReviewOutcome>()
            .HasIndex(x => new { x.PersonRoleId, x.ClientId, x.ClientSequence })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaReviewOutcome>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);
        modelBuilder.Entity<Data.Cogita.CogitaReviewEvent>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);

        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .Property(x => x.ParentItemType)
            .HasMaxLength(32);
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .Property(x => x.ParentCheckType)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .Property(x => x.ParentDirection)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .Property(x => x.ChildItemType)
            .HasMaxLength(32);
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .Property(x => x.ChildCheckType)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .Property(x => x.ChildDirection)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .Property(x => x.LinkHash)
            .HasMaxLength(32)
            .HasColumnType("binary(32)");
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .HasIndex(x => new { x.LibraryId, x.LinkHash })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .HasIndex(x => new { x.LibraryId, x.ChildItemType, x.ChildItemId, x.ChildCheckType, x.ChildDirection });
    }
}
