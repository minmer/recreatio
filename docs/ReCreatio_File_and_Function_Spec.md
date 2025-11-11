# ReCreatio – File and Function Specification

This document lists the **source files that should be created** in the ReCreatio solution and the **key functions** (methods) inside each file, with a short 1–2 sentence description of what each function does.

It assumes the architecture described in the Markdown docs:

- Backend: **ASP.NET Core Web API** (.NET 8+)
- Database: **SQL Server + EF Core**
- Frontend: **React + TypeScript**

The goal is to have a **complete, coherent checklist** of what needs to be implemented.

---

## 1. Backend – Solution Structure

### 1.1 Projects

- `ReCreatio.Domain`
- `ReCreatio.Application`
- `ReCreatio.Infrastructure`
- `ReCreatio.Api`

Optionally later: `ReCreatio.Tests` (unit/integration tests), not detailed here.

---

## 2. Backend – ReCreatio.Domain

### 2.1 Entities

#### `Domain/Users/User.cs`

- `static User Create(string loginIdentifier, PasswordHashSet passwordHashes)`  
  Creates a new user aggregate with initial login identifier and password hash set, and instantiates a MasterRole for the user.
- `void SetPasswordHashes(PasswordHashSet newHashes)`  
  Updates the stored password hashes metadata when a password change has been successfully completed.
- `void ChangeAccountState(AccountState newState, string reason)`  
  Changes the account state (Active, Locked, etc.) while enforcing allowed transitions and recording the reason.
- `void AttachMasterRole(Role masterRole)`  
  Links a MasterRole entity to this user once it has been created and encrypted with MasterKey.

#### `Domain/Users/PasswordHashSet.cs`

- `static PasswordHashSet FromH4(byte[] storedH4, string parameters)`  
  Wraps the stored H4 verifier and KDF parameters in a value object.
- `bool VerifyH3(byte[] h3)`  
  Computes H4 from the provided H3 and compares it with the stored verifier.

#### `Domain/Roles/Role.cs`

- `static Role Create(string name, RoleType type)`  
  Creates a new role (MasterRole, Organisation, Group, Technical, etc.) with the given type.
- `void AddParent(Role parent, RoleRelationshipType relationshipType)`  
  Adds a parent/child link (MemberOf, AdminOf, DelegatedTo).
- `void RemoveParent(Role parent)`  
  Removes a relationship to a parent role.
- `void AttachRoleKey(RoleKey roleKey)`  
  Associates a RoleKey with this role.
- `IEnumerable<Role> GetAncestors()`  
  Returns the ancestor roles according to the role graph (without loading keys).

#### `Domain/Roles/Membership.cs`

- `static Membership Create(User user, Role role, RoleRelationshipType relationshipType)`  
  Creates a membership between a user and a role with a defined relationship type.
- `void MarkAsRevoked()`  
  Marks the membership as revoked so the user can no longer gain keys through this relation.

#### `Domain/Keys/Key.cs`

- `static Key CreateRoleKey(Role ownerRole)`  
  Creates a new RoleKey entry owned by the given role, with generated key id and metadata.
- `static Key CreateDataKey(Role ownerRole, string dataArea)`  
  Creates a new DataKey entry for the given data area and owner role.
- `void MarkAsSuperseded(KeyId newKeyId)`  
  Marks this key as superseded by a newer version (for rotations).
- `bool IsReadable()`  
  Returns whether this key can still be used for decryption according to its flags.

#### `Domain/Keys/SharedView.cs`

- `static SharedView Create(Role ownerRole, SharedViewScope scope)`  
  Creates a new SharedView definition for a specific owner role and data scope.
- `void AttachViewRole(Role viewRole, KeyId viewRoleKeyId)`  
  Links the SharedView to a dedicated view role and its RoleKey.
- `void AttachToUser(User user)`  
  Marks this SharedView as permanently associated with a specific user.

#### `Domain/Ledgers/LedgerEntry.cs`

- `static LedgerEntry Auth(string type, string detailsJson)`  
  Factory for creating Auth Ledger entries (logins, state changes, password changes).
- `static LedgerEntry Key(string type, string detailsJson)`  
  Factory for creating Key Ledger entries (key creation, rotation, SharedView).
- `static LedgerEntry Business(string type, string detailsJson)`  
  Factory for creating Business Ledger entries (intentions, offerings, quizzes).

#### `Domain/Parish/Parish.cs`

- `static Parish Create(string name)`  
  Creates a new parish aggregate root with basic information.
- `void AssignRole(Role parishRole)`  
  Assigns the canonical organisation role representing this parish.

#### `Domain/Parish/Intention.cs`

- `static Intention Create(Parish parish, DateTime massDateTime, string churchName)`  
  Creates a new intention with basic Mass information.
- `void SetTexts(string internalTextCipher, string publicTextCipher)`  
  Assigns encrypted internal and public texts for the intention.
- `void LinkDonor(string donorRefCipher)`  
  Links an encrypted donor reference to this intention.
- `void ChangeStatus(IntentionStatus newStatus)`  
  Changes the status (Planned, Celebrated, Cancelled) with validation.

#### `Domain/Parish/Offering.cs`

- `static Offering Create(Parish parish, Intention intention, string amountCipher, string donorRefCipher)`  
  Creates an offering linked to a parish and an intention, with encrypted amount and donor reference.
- `void CorrectAmount(string newAmountCipher)`  
  Updates the encrypted amount according to business rules (e.g. with log in ledger).

#### `Domain/Donors/Donor.cs`

- `static Donor Create(User? user, string nameCipher, string emailCipher)`  
  Creates a donor profile optionally linked to a user account.
- `void UpdateContact(string nameCipher, string emailCipher)`  
  Updates encrypted donor contact data.

#### `Domain/Quiz/Quiz.cs`

- `static Quiz Create(Role ownerTeacherRole, string title)`  
  Creates a new quiz owned by a teacher role.
- `void AddQuestion(Question question)`  
  Adds a question to the quiz.
- `void Configure(string configCipher)`  
  Sets encrypted configuration data (time limits, etc.).

#### `Domain/Quiz/Question.cs`

- `static Question CreateStatic(string textCipher, string answersCipher, string correctAnswerCipher)`  
  Creates a non-generated question with encrypted text and answers.
- `static Question CreateTemplate(string templateCipher, bool isGenerated)`  
  Creates a question template for generated questions.
- `QuestionInstance InstantiateFromTemplate(RandomParameters parameters)`  
  Generates a concrete question instance for a given parameter set.

#### `Domain/Quiz/LiveSession.cs`

- `static LiveSession Create(Quiz quiz, Role? classRole)`  
  Creates a new live session for a quiz, optionally limited to a class role.
- `void Start()`  
  Marks the session as started and records the start time.
- `void Finish()`  
  Marks the session as finished and sets the end time.

#### `Domain/Quiz/Answer.cs`

- `static Answer Create(LiveSession session, Question question, string participantKey, string answerCipher, int responseTimeMs, string isCorrectCipher)`  
  Creates a new answer record linked to session and question.
- `void UpdateCorrection(string isCorrectCipher)`  
  Updates the encrypted correctness flag if the evaluation changes.

#### `Domain/SharedViews/ParticipantView.cs`

- `static ParticipantView Create(LiveSession session, string participantKey, SharedView sharedView)`  
  Creates a link between a live session participant and a SharedView.
- `void AttachToUser(User user)`  
  Marks this participant view as associated with a specific user account.

---

## 3. Backend – ReCreatio.Application

### 3.1 Authentication and Sessions

#### `Application/Auth/IAuthService.cs`

- `Task<RegistrationResult> RegisterAsync(RegistrationRequest request)`  
  Validates registration data, creates user and MasterRole, and writes Auth Ledger entries.
- `Task<LoginResult> LoginAsync(LoginRequest request)`  
  Verifies H3, derives MasterKey, loads MasterRole and creates a session token.
- `Task LogoutAsync(string sessionId)`  
  Terminates a session and clears associated secret caches.
- `Task ChangePasswordAsync(ChangePasswordRequest request)`  
  Verifies old H3, re-encrypts MasterRole and user key material with new MasterKey, and updates stored H4.
- `Task SwitchSecurityModeAsync(string sessionId, SecurityMode mode)`  
  Switches between Normal and Secure Mode and records the change in Auth Ledger.

#### `Application/Sessions/ISessionService.cs`

- `Task<Session> CreateSessionAsync(Guid userId, SecurityMode mode)`  
  Creates a new session with a random SessionId and initial secret cache state.
- `Task<Session?> GetSessionAsync(string sessionId)`  
  Loads the session record for the given SessionId.
- `Task InvalidateSessionAsync(string sessionId)`  
  Marks a session as invalid and clears secrets.

### 3.2 Roles and Membership

#### `Application/Roles/IRoleService.cs`

- `Task<RoleDto> CreateRoleAsync(CreateRoleCommand command)`  
  Creates a new role in the role graph with specified type and name.
- `Task AddParentAsync(Guid roleId, Guid parentRoleId, RoleRelationshipType relationshipType)`  
  Adds a parent relationship between two roles.
- `Task AddMembershipAsync(AddMembershipCommand command)`  
  Creates membership between a user MasterRole and another role.
- `Task RevokeMembershipAsync(Guid membershipId)`  
  Revokes membership and updates the key graph.

### 3.3 Key Management

#### `Application/Keys/IKeyManagementService.cs`

- `Task<KeyDto> CreateRoleKeyAsync(Guid ownerRoleId)`  
  Generates and stores a new RoleKey for the given role, writing Key Ledger entries.
- `Task<KeyDto> CreateDataKeyAsync(Guid ownerRoleId, string dataArea)`  
  Generates and stores a new DataKey for a specific data area.
- `Task RotateRoleKeyAsync(Guid roleId)`  
  Creates a new RoleKey version for a role and marks previous key as read-only.
- `Task<IEnumerable<KeyDto>> GetKeysForRoleAsync(Guid roleId)`  
  Returns metadata of keys associated with a role.
- `Task<ResolvedKeySet> ResolveKeysForOperationAsync(ResolvedOperationContext context)`  
  Resolves which RoleKeys and DataKeys are needed for a specific operation.

### 3.4 Ledgers

#### `Application/Ledgers/IAuthLedgerService.cs`

- `Task WriteAsync(AuthLedgerEntryDto entry)`  
  Appends a new authentication-related entry to Auth Ledger.
- `Task<IEnumerable<AuthLedgerEntryDto>> QueryAsync(AuthLedgerQuery query)`  
  Queries authentication history for audits.

#### `Application/Ledgers/IKeyLedgerService.cs`

- `Task WriteAsync(KeyLedgerEntryDto entry)`  
  Appends a new key-related entry to Key Ledger.
- `Task<IEnumerable<KeyLedgerEntryDto>> QueryAsync(KeyLedgerQuery query)`  
  Queries key management events for audits.

#### `Application/Ledgers/IBusinessLedgerService.cs`

- `Task WriteAsync(BusinessLedgerEntryDto entry)`  
  Appends a new business event to Business Ledger.
- `Task<IEnumerable<BusinessLedgerEntryDto>> QueryAsync(BusinessLedgerQuery query)`  
  Queries business events (intentions changes, quiz events, etc.).

### 3.5 Parish – Intentions and Offerings

#### `Application/Parish/IIntentionService.cs`

- `Task<IntentionDto> CreateIntentionAsync(CreateIntentionCommand command)`  
  Creates a new intention, encrypting texts and donor references with the correct DataKeys.
- `Task<IntentionDto> UpdateIntentionAsync(UpdateIntentionCommand command)`  
  Updates an existing intention and writes a Business Ledger entry.
- `Task<IEnumerable<IntentionDto>> GetIntentionsForParishAsync(ParishIntentionsQuery query)`  
  Returns a list of intentions for given parish and time range, decrypting only necessary fields.
- `Task<IntentionDetailsDto> GetIntentionDetailsAsync(Guid intentionId, UserContext user)`  
  Returns detailed intention information depending on the caller’s roles.
- `Task<SharedViewDto> CreateIntentionSharedViewAsync(CreateIntentionSharedViewCommand command)`  
  Creates a SharedView and QR/link access for a specific intention and donor.

#### `Application/Parish/IOfferingService.cs`

- `Task<OfferingDto> CreateOfferingAsync(CreateOfferingCommand command)`  
  Registers an offering linked to an intention and encrypts amount and donor reference.
- `Task<OfferingDto> CorrectOfferingAsync(CorrectOfferingCommand command)`  
  Adjusts offering amount (encrypted) according to rules and logs the change.
- `Task<IEnumerable<IntentionWithOfferingsDto>> GetDonorIntentionsAsync(DonorIntentionsQuery query)`  
  Returns intentions and offerings for a specific donor, decrypting only donor-allowed data.

### 3.6 Quiz and Live Participation

#### `Application/Quiz/IQuizService.cs`

- `Task<QuizDto> CreateQuizAsync(CreateQuizCommand command)`  
  Creates a new quiz with configuration and initial questions under the teacher’s role.
- `Task<QuestionDto> AddQuestionAsync(AddQuestionCommand command)`  
  Adds a question or question template to a quiz.
- `Task<LiveSessionDto> StartLiveSessionAsync(StartLiveSessionCommand command)`  
  Starts a live session, creates a QuizSessionRole and generates join codes.
- `Task FinishLiveSessionAsync(Guid liveSessionId)`  
  Marks a running live session as finished and writes a Business Ledger entry.

#### `Application/Quiz/ISessionParticipationService.cs`

- `Task<JoinSessionResult> JoinAsLoggedInAsync(JoinSessionCommand command, UserContext user)`  
  Allows a logged-in student to join a live session, creates a ParticipantKey and ParticipantView.
- `Task<JoinSessionResult> JoinAsAnonymousAsync(JoinSessionAnonymousCommand command)`  
  Allows an anonymous participant to join a live session and creates a SharedView for their results.
- `Task<SubmitAnswerResult> SubmitAnswerAsync(SubmitAnswerCommand command, ParticipantContext participant)`  
  Records an encrypted answer with response time and correctness and returns immediate feedback.
- `Task<LiveSummaryDto> GetLiveSummaryAsync(Guid liveSessionId, UserContext teacher)`  
  Returns aggregated live summary (counts, correctness distribution) for the teacher.

#### `Application/Quiz/IQuizAnalyticsService.cs`

- `Task<TimeCorrectnessGraphDto> GetTimeVsCorrectnessGraphAsync(TimeCorrectnessQuery query)`  
  Computes and returns data for plotting response time vs correctness for one or more questions.
- `Task<ParticipantProgressDto> GetParticipantProgressAsync(ParticipantProgressQuery query)`  
  Returns per-participant evolution of results over time within a quiz or session.

### 3.7 Shared Views

#### `Application/SharedViews/ISharedViewService.cs`

- `Task<SharedViewDto> CreateSharedViewAsync(CreateSharedViewCommand command)`  
  Creates a SharedView, generates SharedViewKey wrapping and a QR/link payload for a given scope.
- `Task<ResolvedSharedViewResult> ResolveSharedViewAsync(ResolveSharedViewCommand command)`  
  Resolves a SharedView from QR/link secret and returns the decrypted data slice appropriate for this view.
- `Task AttachSharedViewToUserAsync(AttachSharedViewCommand command, UserContext user)`  
  Attaches an existing SharedView to the current user so it can be accessed without QR in the future.

---

## 4. Backend – ReCreatio.Infrastructure

### 4.1 Persistence

#### `Infrastructure/Persistence/AppDbContext.cs`

- `DbSet<User> Users` / `DbSet<Role> Roles` / `DbSet<Membership> Memberships` / etc.  
  EF Core DbSets representing the domain entities for persistence.
- `int SaveChangesWithLedgers()`  
  Saves changes and ensures that corresponding ledger entries are persisted atomically.
- `Task<int> SaveChangesWithLedgersAsync()`  
  Async version of saving changes together with ledger entries.

#### `Infrastructure/Persistence/Configurations/*.cs`

For each entity, there is a configuration file, e.g.:

- `UserConfiguration.cs`  
  Configures primary key, indexes and relations for User entity.
- `RoleConfiguration.cs`  
  Configures role graph and ownership relationships.
- `IntentionConfiguration.cs` / `OfferingConfiguration.cs` / `QuizConfiguration.cs` / etc.  
  Configure encryption-related columns, indexes and foreign keys.

### 4.2 Crypto

#### `Infrastructure/Crypto/AesGcmCryptoService.cs`

- `byte[] Encrypt(byte[] plaintext, byte[] key, byte[] associatedData)`  
  Encrypts data using AES-GCM with the provided key and associated data.
- `byte[] Decrypt(byte[] ciphertext, byte[] key, byte[] associatedData)`  
  Decrypts AES-GCM ciphertext and verifies integrity.

#### `Infrastructure/Crypto/KeyDerivationService.cs`

- `byte[] DeriveMasterKey(byte[] h3, Guid userId)`  
  Derives MasterKey from H3 and user-specific salts.
- `byte[] DeriveSharedViewKey(string sharedViewSecret, Guid sharedViewId)`  
  Derives SharedViewKey from QR/link secret and SharedView identifier.
- `byte[] DeriveDataKeyWrappingKey(RoleKey roleKey, string dataArea)`  
  Derives a wrapping key for DataKeys from RoleKey and data area id.

### 4.3 Hashing

#### `Infrastructure/Security/PasswordHashService.cs`

- `byte[] ComputeH4FromH3(byte[] h3)`  
  Computes H4 hash from provided H3 for server-side verification.
- `bool VerifyH3AgainstH4(byte[] h3, byte[] storedH4)`  
  Verifies that H3 corresponds to stored H4.

### 4.4 Key Storage and Resolution

#### `Infrastructure/Keys/KeyStore.cs`

- `Task StoreKeyAsync(Key key)`  
  Persists a key entry in the database along with its encrypted blob.
- `Task<Key?> GetKeyAsync(Guid keyId)`  
  Loads key metadata and encrypted blob by key id.
- `Task<IEnumerable<Key>> GetKeysForOwnerAsync(Guid ownerRoleId)`  
  Loads all keys owned by the specified role.

#### `Infrastructure/Keys/KeyResolver.cs`

- `Task<ResolvedKeySet> ResolveForOperationAsync(ResolvedOperationContext context)`  
  Resolves all keys required for the given operation based on role graph and Key Ledger.
- `Task<byte[]> DecryptDataKeyAsync(Key dataKey, IEnumerable<RoleKey> availableRoleKeys)`  
  Decrypts a DataKey using available RoleKeys.

### 4.5 Ledgers Persistence

#### `Infrastructure/Ledgers/AuthLedgerRepository.cs`

- `Task AppendAsync(LedgerEntry entry)`  
  Appends an Auth Ledger entry to persistent storage.
- `Task<IEnumerable<LedgerEntry>> QueryAsync(AuthLedgerQuery query)`  
  Queries Auth Ledger entries based on time range, user or event type.

#### `Infrastructure/Ledgers/KeyLedgerRepository.cs`

- `Task AppendAsync(LedgerEntry entry)`  
  Appends a Key Ledger entry.
- `Task<IEnumerable<LedgerEntry>> QueryAsync(KeyLedgerQuery query)`  
  Queries Key Ledger entries.

#### `Infrastructure/Ledgers/BusinessLedgerRepository.cs`

- `Task AppendAsync(LedgerEntry entry)`  
  Appends a Business Ledger entry.
- `Task<IEnumerable<LedgerEntry>> QueryAsync(BusinessLedgerQuery query)`  
  Queries Business Ledger entries.

---

## 5. Backend – ReCreatio.Api

### 5.1 Program and Startup

#### `Api/Program.cs`

- `static void Main(string[] args)`  
  Boots the ASP.NET Core application and builds the web host.
- `WebApplication BuildWebApplication(string[] args)`  
  Configures services (DI, DbContext, authentication, controllers) and HTTP pipeline.

### 5.2 Authentication Endpoints

#### `Api/Controllers/AuthController.cs`

- `Task<IActionResult> Register([FromBody] RegistrationRequest request)`  
  Calls `IAuthService.RegisterAsync` and returns success or validation errors.
- `Task<IActionResult> Login([FromBody] LoginRequest request)`  
  Calls `IAuthService.LoginAsync` and returns a session token.
- `Task<IActionResult> Logout()`  
  Extracts session id from token and calls logout.
- `Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)`  
  Invokes password change logic and returns a result.
- `Task<IActionResult> SwitchSecurityMode([FromBody] SwitchSecurityModeRequest request)`  
  Changes session security mode (Normal/Secure).

### 5.3 Roles and Keys Endpoints (Admin)

#### `Api/Controllers/RolesController.cs`

- `Task<IActionResult> CreateRole([FromBody] CreateRoleCommand command)`  
  Creates a new role and returns its id.
- `Task<IActionResult> AddParent([FromBody] AddParentRequest request)`  
  Adds a parent relationship between roles.
- `Task<IActionResult> AddMembership([FromBody] AddMembershipCommand command)`  
  Adds a membership between user and role.
- `Task<IActionResult> RevokeMembership(Guid membershipId)`  
  Revokes a membership.

#### `Api/Controllers/KeysController.cs`

- `Task<IActionResult> CreateRoleKey(Guid roleId)`  
  Creates a new RoleKey for a role.
- `Task<IActionResult> CreateDataKey([FromBody] CreateDataKeyCommand command)`  
  Creates a new DataKey for specified data area.
- `Task<IActionResult> RotateRoleKey(Guid roleId)`  
  Rotates keys for a given role.
- `Task<IActionResult> GetKeysForRole(Guid roleId)`  
  Returns key metadata for a role.

### 5.4 Parish – Intentions and Offerings

#### `Api/Controllers/ParishIntentionsController.cs`

- `Task<IActionResult> GetIntentions([FromQuery] ParishIntentionsQuery query)`  
  Returns intentions for a parish for public or staff views depending on caller.
- `Task<IActionResult> GetIntentionDetails(Guid id)`  
  Returns detailed information about a single intention, respecting security roles.
- `Task<IActionResult> CreateIntention([FromBody] CreateIntentionCommand command)`  
  Creates a new intention from office staff input.
- `Task<IActionResult> UpdateIntention([FromBody] UpdateIntentionCommand command)`  
  Updates an existing intention.
- `Task<IActionResult> CreateOffering([FromBody] CreateOfferingCommand command)`  
  Creates an offering linked to an intention.
- `Task<IActionResult> GetDonorIntentions([FromQuery] DonorIntentionsQuery query)`  
  Returns donor’s own intentions and offerings for logged-in donors.

#### `Api/Controllers/IntentionSharedViewController.cs`

- `Task<IActionResult> CreateSharedView([FromBody] CreateIntentionSharedViewCommand command)`  
  Creates a SharedView for a specific intention and returns QR/link payload.

### 5.5 Quiz and Live Participation

#### `Api/Controllers/QuizController.cs`

- `Task<IActionResult> CreateQuiz([FromBody] CreateQuizCommand command)`  
  Creates a quiz under the teacher’s role.
- `Task<IActionResult> AddQuestion([FromBody] AddQuestionCommand command)`  
  Adds a question to a quiz.
- `Task<IActionResult> StartLiveSession([FromBody] StartLiveSessionCommand command)`  
  Starts a live session and returns join information.
- `Task<IActionResult> FinishLiveSession(Guid liveSessionId)`  
  Finishes a live session.

#### `Api/Controllers/LiveSessionController.cs`

- `Task<IActionResult> JoinAsLoggedIn([FromBody] JoinSessionRequest request)`  
  Allows an authenticated user to join a session.
- `Task<IActionResult> JoinAsAnonymous([FromBody] JoinSessionAnonymousRequest request)`  
  Creates an anonymous participant with SharedView.
- `Task<IActionResult> SubmitAnswer([FromBody] SubmitAnswerCommand command)`  
  Records an answer and returns immediate feedback.
- `Task<IActionResult> GetLiveSummary(Guid liveSessionId)`  
  Returns live summary for teachers (counts, correctness, basic charts data).

#### `Api/Controllers/QuizAnalyticsController.cs`

- `Task<IActionResult> GetTimeVsCorrectness([FromQuery] TimeCorrectnessQuery query)`  
  Returns aggregated data for time vs correctness plot.
- `Task<IActionResult> GetParticipantProgress([FromQuery] ParticipantProgressQuery query)`  
  Returns per-participant progress for a teacher.

### 5.6 SharedViews Endpoints

#### `Api/Controllers/SharedViewController.cs`

- `Task<IActionResult> Resolve([FromBody] ResolveSharedViewRequest request)`  
  Resolves SharedView from QR/link secret and returns allowed data slice.
- `Task<IActionResult> AttachToCurrentUser([FromBody] AttachSharedViewRequest request)`  
  Attaches a SharedView to the currently logged-in user.

### 5.7 Ledgers Endpoints (Admin / Audit)

#### `Api/Controllers/LedgersController.cs`

- `Task<IActionResult> GetAuthLedger([FromQuery] AuthLedgerQuery query)`  
  Returns Auth Ledger entries for security audits.
- `Task<IActionResult> GetKeyLedger([FromQuery] KeyLedgerQuery query)`  
  Returns Key Ledger entries.
- `Task<IActionResult> GetBusinessLedger([FromQuery] BusinessLedgerQuery query)`  
  Returns Business Ledger entries.

---

## 6. Frontend – React + TypeScript

### 6.1 Project Structure

- `src/api` – HTTP clients for backend endpoints.
- `src/features/auth` – login/registration UI.
- `src/features/parishIntentions` – parish intentions and offerings UI.
- `src/features/quiz` – teacher and participant quiz UI.
- `src/features/sharedViews` – QR/link SharedView pages.
- `src/components` – reusable components (charts, forms).
- `src/hooks` – custom hooks for live updates, auth, etc.

### 6.2 API Clients

#### `src/api/httpClient.ts`

- `request<T>(method: HttpMethod, url: string, body?: any, options?: RequestOptions): Promise<T>`  
  Performs a HTTP request with proper headers (auth token, JSON) and returns typed response.
- `setAuthToken(token: string | null)`  
  Stores or clears the current auth token used for subsequent requests.

#### `src/api/authApi.ts`

- `register(request: RegistrationRequest): Promise<RegistrationResponse>`  
  Calls backend registration endpoint.
- `login(request: LoginRequest): Promise<LoginResponse>`  
  Calls backend login endpoint and returns token + basic user info.
- `logout(): Promise<void>`  
  Calls backend logout endpoint.
- `changePassword(request: ChangePasswordRequest): Promise<void>`  
  Calls backend password change endpoint.

#### `src/api/parishIntentionsApi.ts`

- `getIntentions(query: ParishIntentionsQuery): Promise<IntentionSummaryDto[]>`  
  Fetches intention summaries for a parish.
- `getIntentionDetails(id: string): Promise<IntentionDetailsDto>`  
  Fetches detailed information about a specific intention.
- `createIntention(command: CreateIntentionCommand): Promise<IntentionDto>`  
  Sends request to create a new intention.
- `updateIntention(command: UpdateIntentionCommand): Promise<IntentionDto>`  
  Sends request to update an existing intention.
- `createOffering(command: CreateOfferingCommand): Promise<OfferingDto>`  
  Sends request to create an offering.
- `getDonorIntentions(query: DonorIntentionsQuery): Promise<IntentionWithOfferingsDto[]>`  
  Fetches intentions and offerings for the current donor.

#### `src/api/quizApi.ts`

- `createQuiz(command: CreateQuizCommand): Promise<QuizDto>`  
  Creates a quiz as a teacher.
- `addQuestion(command: AddQuestionCommand): Promise<QuestionDto>`  
  Adds a question to a quiz.
- `startLiveSession(command: StartLiveSessionCommand): Promise<LiveSessionDto>`  
  Starts a live session and returns join info.
- `finishLiveSession(id: string): Promise<void>`  
  Ends a live session.
- `joinSessionAsLoggedIn(request: JoinSessionRequest): Promise<JoinSessionResult>`  
  Joins a live session as a logged-in user.
- `joinSessionAsAnonymous(request: JoinSessionAnonymousRequest): Promise<JoinSessionResult>`  
  Joins a live session anonymously.
- `submitAnswer(command: SubmitAnswerCommand): Promise<SubmitAnswerResult>`  
  Submits an answer and receives feedback.
- `getLiveSummary(id: string): Promise<LiveSummaryDto>`  
  Fetches live summary for teacher view.
- `getTimeVsCorrectness(query: TimeCorrectnessQuery): Promise<TimeCorrectnessGraphDto>`  
  Fetches analytics data for charts.
- `getParticipantProgress(query: ParticipantProgressQuery): Promise<ParticipantProgressDto>`  
  Fetches participant progress analytics.

#### `src/api/sharedViewApi.ts`

- `resolveSharedView(request: ResolveSharedViewRequest): Promise<ResolvedSharedViewResult>`  
  Calls backend to resolve a SharedView from QR/link secret.
- `attachSharedView(request: AttachSharedViewRequest): Promise<void>`  
  Attaches a SharedView to the current user account.

### 6.3 Auth Feature

#### `src/features/auth/LoginPage.tsx`

- `function LoginPage()`  
  React component rendering login form, calling `authApi.login` and storing the token on success.

#### `src/features/auth/RegisterPage.tsx`

- `function RegisterPage()`  
  React component rendering registration form and calling `authApi.register`.

#### `src/features/auth/ChangePasswordPage.tsx`

- `function ChangePasswordPage()`  
  Component for changing password by calling `authApi.changePassword`.

### 6.4 Parish Intentions Feature

#### `src/features/parishIntentions/IntentionsListPage.tsx`

- `function IntentionsListPage()`  
  Displays a list of intentions for a parish, using `parishIntentionsApi.getIntentions`.

#### `src/features/parishIntentions/IntentionDetailsPage.tsx`

- `function IntentionDetailsPage()`  
  Shows detailed information for a single intention and, if authorised, offerings and donor info.

#### `src/features/parishIntentions/ManageIntentionPage.tsx`

- `function ManageIntentionPage()`  
  Form for creating or editing an intention for authorised parish staff.

#### `src/features/parishIntentions/DonorIntentionsPage.tsx`

- `function DonorIntentionsPage()`  
  Shows logged-in donor their own intentions and offerings.

### 6.5 Quiz Feature

#### `src/features/quiz/QuizEditorPage.tsx`

- `function QuizEditorPage()`  
  Lets teacher create a quiz and configure questions.

#### `src/features/quiz/LiveSessionTeacherPage.tsx`

- `function LiveSessionTeacherPage()`  
  Shows teacher live stats (who joined, answer distribution) during a session.

#### `src/features/quiz/LiveSessionJoinPage.tsx`

- `function LiveSessionJoinPage()`  
  Lets participant join a live session with a code or generic QR.

#### `src/features/quiz/LiveSessionParticipantPage.tsx`

- `function LiveSessionParticipantPage()`  
  Displays questions to the participant and sends answers to the backend.

#### `src/features/quiz/ParticipantResultsPage.tsx`

- `function ParticipantResultsPage()`  
  Shows results and analytics for a participant (logged-in student) after the session.

### 6.6 SharedViews Feature

#### `src/features/sharedViews/SharedViewResultPage.tsx`

- `function SharedViewResultPage()`  
  Reads QR/link parameters, calls `sharedViewApi.resolveSharedView` and shows quiz results or intention slice.

#### `src/features/sharedViews/AttachSharedViewPage.tsx`

- `function AttachSharedViewPage()`  
  Allows a logged-in user to attach a SharedView (from QR/link) permanently to their account.

### 6.7 Reusable Components

#### `src/components/TimeVsCorrectnessChart.tsx`

- `function TimeVsCorrectnessChart(props: { data: TimeCorrectnessGraphDto })`  
  Renders a chart for time vs correctness analytics.

#### `src/components/IntentionCard.tsx`

- `function IntentionCard(props: { intention: IntentionSummaryDto })`  
  Displays basic information about an intention in card form.

#### `src/components/QuizQuestionView.tsx`

- `function QuizQuestionView(props: { question: QuestionViewModel, onAnswer: (answer: AnswerPayload) => void })`  
  Displays a quiz question and sends selected answer to the parent.

---

## 7. Summary

This file enumerates:

- Backend projects, key domain entities and their important methods.
- Application services and interfaces required to implement authentication, roles, keys, ledgers, parish intentions, quizzes and SharedViews.
- Infrastructure components for persistence, crypto, key storage and ledgers.
- API controllers mapping HTTP endpoints to application services.
- Frontend structure with API clients, feature pages and reusable components.

It can be used as a **checklist for implementation**: whenever a file or function from this list is missing, some part of the described behaviour will not yet be implemented.
