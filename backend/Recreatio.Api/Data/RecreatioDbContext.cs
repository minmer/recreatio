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
    public DbSet<Data.Parish.ParishConfirmationCandidate> ParishConfirmationCandidates => Set<Data.Parish.ParishConfirmationCandidate>();
    public DbSet<Data.Parish.ParishConfirmationPhoneVerification> ParishConfirmationPhoneVerifications =>
        Set<Data.Parish.ParishConfirmationPhoneVerification>();
    public DbSet<Data.Pilgrimage.PilgrimageEvent> PilgrimageEvents => Set<Data.Pilgrimage.PilgrimageEvent>();
    public DbSet<Data.Pilgrimage.PilgrimageSiteConfig> PilgrimageSiteConfigs => Set<Data.Pilgrimage.PilgrimageSiteConfig>();
    public DbSet<Data.Pilgrimage.PilgrimageParticipant> PilgrimageParticipants => Set<Data.Pilgrimage.PilgrimageParticipant>();
    public DbSet<Data.Pilgrimage.PilgrimageParticipantAccessToken> PilgrimageParticipantAccessTokens =>
        Set<Data.Pilgrimage.PilgrimageParticipantAccessToken>();
    public DbSet<Data.Pilgrimage.PilgrimageAnnouncement> PilgrimageAnnouncements => Set<Data.Pilgrimage.PilgrimageAnnouncement>();
    public DbSet<Data.Pilgrimage.PilgrimageTask> PilgrimageTasks => Set<Data.Pilgrimage.PilgrimageTask>();
    public DbSet<Data.Pilgrimage.PilgrimageParticipantIssue> PilgrimageParticipantIssues => Set<Data.Pilgrimage.PilgrimageParticipantIssue>();
    public DbSet<Data.Pilgrimage.PilgrimageContactInquiry> PilgrimageContactInquiries => Set<Data.Pilgrimage.PilgrimageContactInquiry>();
    public DbSet<Data.Pilgrimage.PortalAdminAssignment> PortalAdminAssignments => Set<Data.Pilgrimage.PortalAdminAssignment>();
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
    public DbSet<Data.Cogita.CogitaQuestion> CogitaQuestions => Set<Data.Cogita.CogitaQuestion>();
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
    public DbSet<Data.Cogita.CogitaReviewEvent> CogitaReviewEvents => Set<Data.Cogita.CogitaReviewEvent>();
    public DbSet<Data.Cogita.CogitaReviewOutcome> CogitaReviewOutcomes => Set<Data.Cogita.CogitaReviewOutcome>();
    public DbSet<Data.Cogita.CogitaStatisticEvent> CogitaStatisticEvents => Set<Data.Cogita.CogitaStatisticEvent>();
    public DbSet<Data.Cogita.CogitaRevision> CogitaRevisions => Set<Data.Cogita.CogitaRevision>();
    public DbSet<Data.Cogita.CogitaRevisionShare> CogitaRevisionShares => Set<Data.Cogita.CogitaRevisionShare>();
    public DbSet<Data.Cogita.CogitaLiveRevisionSession> CogitaLiveRevisionSessions => Set<Data.Cogita.CogitaLiveRevisionSession>();
    public DbSet<Data.Cogita.CogitaLiveRevisionParticipant> CogitaLiveRevisionParticipants => Set<Data.Cogita.CogitaLiveRevisionParticipant>();
    public DbSet<Data.Cogita.CogitaLiveRevisionAnswer> CogitaLiveRevisionAnswers => Set<Data.Cogita.CogitaLiveRevisionAnswer>();
    public DbSet<Data.Cogita.CogitaLiveRevisionReloginRequest> CogitaLiveRevisionReloginRequests => Set<Data.Cogita.CogitaLiveRevisionReloginRequest>();
    public DbSet<Data.Cogita.CogitaCreationProject> CogitaCreationProjects => Set<Data.Cogita.CogitaCreationProject>();
    public DbSet<Data.Cogita.CogitaItemDependency> CogitaItemDependencies => Set<Data.Cogita.CogitaItemDependency>();
    public DbSet<Data.Cogita.CogitaKnowledgeTypeSpec> CogitaKnowledgeTypeSpecs => Set<Data.Cogita.CogitaKnowledgeTypeSpec>();
    public DbSet<Data.Cogita.CogitaKnowledgeItem> CogitaKnowledgeItems => Set<Data.Cogita.CogitaKnowledgeItem>();
    public DbSet<Data.Cogita.CogitaRevisionRun> CogitaRevisionRuns => Set<Data.Cogita.CogitaRevisionRun>();
    public DbSet<Data.Cogita.CogitaRunAttempt> CogitaRunAttempts => Set<Data.Cogita.CogitaRunAttempt>();
    public DbSet<Data.Cogita.CogitaRunExposure> CogitaRunExposures => Set<Data.Cogita.CogitaRunExposure>();
    public DbSet<Data.Cogita.CogitaKnownessSnapshot> CogitaKnownessSnapshots => Set<Data.Cogita.CogitaKnownessSnapshot>();
    public DbSet<Data.Cogita.CogitaCreationArtifact> CogitaCreationArtifacts => Set<Data.Cogita.CogitaCreationArtifact>();
    public DbSet<Data.Cogita.CogitaReferenceCryptoField> CogitaReferenceCryptoFields => Set<Data.Cogita.CogitaReferenceCryptoField>();
    public DbSet<Data.Cogita.CogitaDashboardPreference> CogitaDashboardPreferences => Set<Data.Cogita.CogitaDashboardPreference>();
    public DbSet<Data.Cogita.Core.CogitaKnowledgeLinkSingleCore> CogitaKnowledgeLinkSinglesCore => Set<Data.Cogita.Core.CogitaKnowledgeLinkSingleCore>();
    public DbSet<Data.Cogita.Core.CogitaKnowledgeLinkMultiCore> CogitaKnowledgeLinkMultisCore => Set<Data.Cogita.Core.CogitaKnowledgeLinkMultiCore>();
    public DbSet<Data.Cogita.Core.CogitaCheckcardDefinitionCore> CogitaCheckcardDefinitionsCore => Set<Data.Cogita.Core.CogitaCheckcardDefinitionCore>();
    public DbSet<Data.Cogita.Core.CogitaDependencyEdgeCore> CogitaDependencyEdgesCore => Set<Data.Cogita.Core.CogitaDependencyEdgeCore>();
    public DbSet<Data.Cogita.Core.CogitaRevisionPatternCore> CogitaRevisionPatternsCore => Set<Data.Cogita.Core.CogitaRevisionPatternCore>();
    public DbSet<Data.Cogita.Core.CogitaRunParticipantCore> CogitaRunParticipantsCore => Set<Data.Cogita.Core.CogitaRunParticipantCore>();
    public DbSet<Data.Cogita.Core.CogitaRunEventCore> CogitaRunEventsCore => Set<Data.Cogita.Core.CogitaRunEventCore>();
    public DbSet<Data.Chat.ChatConversation> ChatConversations => Set<Data.Chat.ChatConversation>();
    public DbSet<Data.Chat.ChatConversationParticipant> ChatConversationParticipants => Set<Data.Chat.ChatConversationParticipant>();
    public DbSet<Data.Chat.ChatConversationKeyVersion> ChatConversationKeyVersions => Set<Data.Chat.ChatConversationKeyVersion>();
    public DbSet<Data.Chat.ChatMessage> ChatMessages => Set<Data.Chat.ChatMessage>();
    public DbSet<Data.Chat.ChatConversationReadState> ChatConversationReadStates => Set<Data.Chat.ChatConversationReadState>();
    public DbSet<Data.Chat.ChatPublicLink> ChatPublicLinks => Set<Data.Chat.ChatPublicLink>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // These Core entities map to the same tables as active runtime entities.
        // Keep them out of the EF runtime model to avoid shared-table conflicts.
        modelBuilder.Ignore<Data.Cogita.Core.CogitaKnowledgeTypeSpecCore>();
        modelBuilder.Ignore<Data.Cogita.Core.CogitaKnowledgeItemCore>();
        modelBuilder.Ignore<Data.Cogita.Core.CogitaRevisionShareCore>();
        modelBuilder.Ignore<Data.Cogita.Core.CogitaRevisionRunCore>();
        modelBuilder.Ignore<Data.Cogita.Core.CogitaRunAttemptCore>();
        modelBuilder.Ignore<Data.Cogita.Core.CogitaRunExposureCore>();
        modelBuilder.Ignore<Data.Cogita.Core.CogitaKnownessSnapshotCore>();

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

        modelBuilder.Entity<Data.Parish.ParishConfirmationCandidate>()
            .HasIndex(x => new { x.ParishId, x.CreatedUtc });

        modelBuilder.Entity<Data.Parish.ParishConfirmationPhoneVerification>()
            .HasIndex(x => x.VerificationToken)
            .IsUnique();

        modelBuilder.Entity<Data.Parish.ParishConfirmationPhoneVerification>()
            .HasIndex(x => new { x.CandidateId, x.PhoneIndex })
            .IsUnique();

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageEvent>()
            .HasIndex(x => x.Slug)
            .IsUnique();

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageSiteConfig>()
            .HasIndex(x => x.EventId)
            .IsUnique();

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageParticipant>()
            .HasIndex(x => new { x.EventId, x.CreatedUtc });

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageParticipantAccessToken>()
            .HasIndex(x => x.TokenHash)
            .IsUnique();

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageParticipantAccessToken>()
            .HasIndex(x => new { x.EventId, x.ParticipantId });

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageAnnouncement>()
            .HasIndex(x => new { x.EventId, x.CreatedUtc });

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageTask>()
            .HasIndex(x => new { x.EventId, x.Status, x.UpdatedUtc });

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageParticipantIssue>()
            .HasIndex(x => new { x.EventId, x.Status, x.UpdatedUtc });

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageParticipantIssue>()
            .HasIndex(x => new { x.EventId, x.ParticipantId, x.CreatedUtc });

        modelBuilder.Entity<Data.Pilgrimage.PilgrimageContactInquiry>()
            .HasIndex(x => new { x.EventId, x.Status, x.UpdatedUtc });

        modelBuilder.Entity<Data.Pilgrimage.PortalAdminAssignment>()
            .HasIndex(x => x.ScopeKey)
            .IsUnique();

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

        modelBuilder.Entity<Data.Chat.ChatConversation>()
            .HasIndex(x => x.UpdatedUtc);
        modelBuilder.Entity<Data.Chat.ChatConversation>()
            .HasIndex(x => new { x.ScopeType, x.ScopeId, x.UpdatedUtc });
        modelBuilder.Entity<Data.Chat.ChatConversation>()
            .HasIndex(x => x.PublicCodeHash)
            .HasFilter("[PublicCodeHash] IS NOT NULL");

        modelBuilder.Entity<Data.Chat.ChatConversationParticipant>()
            .HasIndex(x => new { x.ConversationId, x.RemovedUtc });
        modelBuilder.Entity<Data.Chat.ChatConversationParticipant>()
            .HasIndex(x => new { x.ConversationId, x.SubjectType, x.SubjectId, x.RemovedUtc });
        modelBuilder.Entity<Data.Chat.ChatConversationParticipant>()
            .HasOne<Data.Chat.ChatConversation>()
            .WithMany()
            .HasForeignKey(x => x.ConversationId);

        modelBuilder.Entity<Data.Chat.ChatConversationKeyVersion>()
            .HasIndex(x => new { x.ConversationId, x.Version })
            .IsUnique();
        modelBuilder.Entity<Data.Chat.ChatConversationKeyVersion>()
            .HasOne<Data.Chat.ChatConversation>()
            .WithMany()
            .HasForeignKey(x => x.ConversationId);

        modelBuilder.Entity<Data.Chat.ChatMessage>()
            .HasIndex(x => new { x.ConversationId, x.Sequence })
            .IsUnique();
        modelBuilder.Entity<Data.Chat.ChatMessage>()
            .HasIndex(x => new { x.ConversationId, x.CreatedUtc });
        modelBuilder.Entity<Data.Chat.ChatMessage>()
            .HasIndex(x => new { x.ConversationId, x.Visibility, x.Sequence });
        modelBuilder.Entity<Data.Chat.ChatMessage>()
            .HasOne<Data.Chat.ChatConversation>()
            .WithMany()
            .HasForeignKey(x => x.ConversationId);

        modelBuilder.Entity<Data.Chat.ChatConversationReadState>()
            .HasIndex(x => new { x.ConversationId, x.UserId })
            .IsUnique();
        modelBuilder.Entity<Data.Chat.ChatConversationReadState>()
            .HasOne<Data.Chat.ChatConversation>()
            .WithMany()
            .HasForeignKey(x => x.ConversationId);

        modelBuilder.Entity<Data.Chat.ChatPublicLink>()
            .HasIndex(x => x.CodeHash)
            .IsUnique();

        modelBuilder.Entity<Data.Cogita.CogitaKnowledgeTypeSpec>()
            .HasIndex(x => new { x.LibraryId, x.TypeKey, x.Version })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaKnowledgeItem>()
            .HasIndex(x => new { x.LibraryId, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaKnowledgeItem>()
            .HasIndex(x => new { x.LibraryId, x.TypeKey, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaRevisionRun>()
            .HasIndex(x => new { x.LibraryId, x.Status, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaRevisionRun>()
            .HasIndex(x => x.SessionCodeHash)
            .IsUnique()
            .HasFilter("[SessionCodeHash] IS NOT NULL");
        modelBuilder.Entity<Data.Cogita.CogitaRunAttempt>()
            .HasIndex(x => new { x.RunId, x.ParticipantId, x.RoundIndex, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaRunAttempt>()
            .HasIndex(x => new { x.RunId, x.CardKey, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaRunExposure>()
            .HasIndex(x => new { x.RunId, x.ParticipantId, x.RoundIndex });
        modelBuilder.Entity<Data.Cogita.CogitaKnownessSnapshot>()
            .HasIndex(x => new { x.LibraryId, x.PersonRoleId, x.CardKey, x.SnapshotUtc });
        modelBuilder.Entity<Data.Cogita.CogitaCreationArtifact>()
            .HasIndex(x => new { x.LibraryId, x.ProjectId, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaCreationArtifact>()
            .HasIndex(x => new { x.LibraryId, x.SourceItemId, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaReferenceCryptoField>()
            .HasIndex(x => new { x.LibraryId, x.OwnerEntity, x.OwnerId, x.FieldKey })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaReferenceCryptoField>()
            .HasIndex(x => new { x.LibraryId, x.FieldKey, x.DeterministicHash });
        modelBuilder.Entity<Data.Cogita.CogitaDashboardPreference>()
            .HasIndex(x => x.UserId)
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaDashboardPreference>()
            .HasIndex(x => x.UpdatedUtc);

        modelBuilder.Entity<Data.Cogita.Core.CogitaKnowledgeLinkSingleCore>()
            .HasIndex(x => new { x.SourceItemId, x.FieldKey })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.Core.CogitaKnowledgeLinkMultiCore>()
            .HasIndex(x => new { x.SourceItemId, x.FieldKey, x.TargetItemId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.Core.CogitaKnowledgeLinkMultiCore>()
            .HasIndex(x => new { x.SourceItemId, x.FieldKey, x.SortOrder });
        modelBuilder.Entity<Data.Cogita.Core.CogitaCheckcardDefinitionCore>()
            .HasIndex(x => new { x.LibraryId, x.CardKey })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.Core.CogitaCheckcardDefinitionCore>()
            .HasIndex(x => new { x.SourceItemId, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.Core.CogitaDependencyEdgeCore>()
            .HasIndex(x => new { x.ParentCardId, x.ChildCardId })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.Core.CogitaDependencyEdgeCore>()
            .HasIndex(x => new { x.ChildCardId, x.ParentCardId });
        modelBuilder.Entity<Data.Cogita.Core.CogitaRevisionPatternCore>()
            .HasIndex(x => new { x.LibraryId, x.UpdatedUtc });
        modelBuilder.Entity<Data.Cogita.Core.CogitaRunParticipantCore>()
            .HasIndex(x => new { x.RunId, x.JoinedUtc });
        modelBuilder.Entity<Data.Cogita.Core.CogitaRunParticipantCore>()
            .HasIndex(x => new { x.RunId, x.PersonRoleId });
        modelBuilder.Entity<Data.Cogita.Core.CogitaRunEventCore>()
            .HasIndex(x => new { x.RunId, x.CreatedUtc });
        modelBuilder.Entity<Data.Cogita.Core.CogitaRunEventCore>()
            .HasIndex(x => new { x.ParticipantId, x.CreatedUtc });
        modelBuilder.Entity<Data.Chat.ChatPublicLink>()
            .HasIndex(x => new { x.ConversationId, x.IsActive, x.RevokedUtc, x.ExpiresUtc });
        modelBuilder.Entity<Data.Chat.ChatPublicLink>()
            .HasOne<Data.Chat.ChatConversation>()
            .WithMany()
            .HasForeignKey(x => x.ConversationId);


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
        modelBuilder.Entity<Data.Cogita.CogitaInfoLinkMulti>()
            .HasIndex(x => new { x.LibraryId, x.InfoId, x.SortOrder });
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
            .HasIndex(x => new { x.LibraryId, x.RevisionId, x.RevokedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaRevisionShare>()
            .HasIndex(x => x.RevisionId)
            .HasFilter("[RevokedUtc] IS NULL")
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaRevisionShare>()
            .HasIndex(x => x.PublicCodeHash);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionSession>()
            .Property(x => x.Status)
            .HasMaxLength(24);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionSession>()
            .HasIndex(x => new { x.LibraryId, x.RevisionId });
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionSession>()
            .HasIndex(x => x.PublicCodeHash)
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionParticipant>()
            .Property(x => x.DisplayName)
            .HasMaxLength(120);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionParticipant>()
            .HasIndex(x => new { x.SessionId, x.DisplayNameHash });
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionParticipant>()
            .HasIndex(x => new { x.SessionId, x.DisplayName });
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionParticipant>()
            .HasIndex(x => x.JoinTokenHash)
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionAnswer>()
            .HasIndex(x => new { x.SessionId, x.RoundIndex });
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionAnswer>()
            .HasIndex(x => new { x.SessionId, x.ParticipantId, x.RoundIndex })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionReloginRequest>()
            .Property(x => x.DisplayName)
            .HasMaxLength(120);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionReloginRequest>()
            .Property(x => x.Status)
            .HasMaxLength(24);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionReloginRequest>()
            .HasIndex(x => new { x.SessionId, x.DisplayNameHash, x.Status });
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionReloginRequest>()
            .HasIndex(x => new { x.SessionId, x.DisplayName, x.Status });
        modelBuilder.Entity<Data.Cogita.CogitaCreationProject>()
            .Property(x => x.ProjectType)
            .HasMaxLength(32);
        modelBuilder.Entity<Data.Cogita.CogitaCreationProject>()
            .Property(x => x.Name)
            .HasMaxLength(256);
        modelBuilder.Entity<Data.Cogita.CogitaCreationProject>()
            .HasIndex(x => new { x.LibraryId, x.ProjectType, x.UpdatedUtc, x.Id });
        modelBuilder.Entity<Data.Cogita.CogitaCreationProject>()
            .HasIndex(x => new { x.LibraryId, x.ProjectType, x.Name });
        modelBuilder.Entity<Data.Cogita.CogitaCreationProject>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);

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
        modelBuilder.Entity<Data.Cogita.CogitaQuestion>()
            .HasKey(x => x.InfoId);
        modelBuilder.Entity<Data.Cogita.CogitaQuestion>()
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
        modelBuilder.Entity<Data.Cogita.CogitaDependencyGraph>()
            .Property(x => x.Name)
            .HasMaxLength(200);

        modelBuilder.Entity<Data.Cogita.CogitaDependencyGraphNode>()
            .HasOne<Data.Cogita.CogitaDependencyGraph>()
            .WithMany()
            .HasForeignKey(x => x.GraphId);

        modelBuilder.Entity<Data.Cogita.CogitaDependencyGraphEdge>()
            .HasOne<Data.Cogita.CogitaDependencyGraph>()
            .WithMany()
            .HasForeignKey(x => x.GraphId);

        modelBuilder.Entity<Data.Cogita.CogitaReviewEvent>()
            .HasIndex(x => new { x.PersonRoleId, x.ItemType, x.ItemId, x.CreatedUtc });

        modelBuilder.Entity<Data.Cogita.CogitaReviewOutcome>()
            .HasIndex(x => new { x.PersonRoleId, x.ItemType, x.ItemId, x.CheckType, x.Direction, x.CreatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaReviewOutcome>()
            .HasIndex(x => new { x.PersonRoleId, x.ClientId, x.ClientSequence })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .Property(x => x.ScopeType)
            .HasMaxLength(32);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .Property(x => x.SourceType)
            .HasMaxLength(32);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .Property(x => x.EventType)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .Property(x => x.ParticipantLabel)
            .HasMaxLength(120);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .Property(x => x.ItemType)
            .HasMaxLength(32);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .Property(x => x.CheckType)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .Property(x => x.Direction)
            .HasMaxLength(64);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .Property(x => x.CardKey)
            .HasMaxLength(256);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .HasIndex(x => new { x.LibraryId, x.ScopeType, x.ScopeId, x.CreatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .HasIndex(x => new { x.PersonRoleId, x.CreatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .HasIndex(x => new { x.ParticipantId, x.CreatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .HasIndex(x => new { x.SessionId, x.RoundIndex, x.CreatedUtc });
        modelBuilder.Entity<Data.Cogita.CogitaReviewOutcome>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);
        modelBuilder.Entity<Data.Cogita.CogitaReviewEvent>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);
        modelBuilder.Entity<Data.Cogita.CogitaStatisticEvent>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);

        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionSession>()
            .HasOne<Data.Cogita.CogitaLibrary>()
            .WithMany()
            .HasForeignKey(x => x.LibraryId);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionSession>()
            .HasOne<Data.Cogita.CogitaRevision>()
            .WithMany()
            .HasForeignKey(x => x.RevisionId);
        modelBuilder.Entity<Data.Cogita.CogitaRevisionShare>()
            .HasOne<Data.Cogita.CogitaRevision>()
            .WithMany()
            .HasForeignKey(x => x.RevisionId);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionParticipant>()
            .HasOne<Data.Cogita.CogitaLiveRevisionSession>()
            .WithMany()
            .HasForeignKey(x => x.SessionId);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionAnswer>()
            .HasOne<Data.Cogita.CogitaLiveRevisionSession>()
            .WithMany()
            .HasForeignKey(x => x.SessionId);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionAnswer>()
            .HasOne<Data.Cogita.CogitaLiveRevisionParticipant>()
            .WithMany()
            .HasForeignKey(x => x.ParticipantId);
        modelBuilder.Entity<Data.Cogita.CogitaLiveRevisionReloginRequest>()
            .HasOne<Data.Cogita.CogitaLiveRevisionSession>()
            .WithMany()
            .HasForeignKey(x => x.SessionId);

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
            .HasOne<Data.Cogita.CogitaDependencyGraph>()
            .WithMany()
            .HasForeignKey(x => x.GraphId);
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .HasIndex(x => new { x.LibraryId, x.GraphId, x.LinkHash })
            .IsUnique();
        modelBuilder.Entity<Data.Cogita.CogitaItemDependency>()
            .HasIndex(x => new { x.LibraryId, x.GraphId, x.ChildItemType, x.ChildItemId, x.ChildCheckType, x.ChildDirection });
    }
}
