using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cogita;
using Recreatio.Api.Data.Cogita.Core;
using Recreatio.Api.Domain.Cogita;
using Recreatio.Api.Security;

namespace Recreatio.Api.Endpoints.Cogita;

public static class CogitaCoreRuntimeEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan SharedRecoveryTtl = TimeSpan.FromMinutes(20);

    private static byte[] HashRecoveryToken(string token)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(token));
    }

    private static string GenerateRecoveryToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private static DateTimeOffset? ParseRecoveryExpirationUtc(string? cipher)
    {
        if (string.IsNullOrWhiteSpace(cipher))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(cipher);
            if (!document.RootElement.TryGetProperty("expUtc", out var expNode))
            {
                return null;
            }
            if (!expNode.TryGetDateTimeOffset(out var value))
            {
                return null;
            }
            return value;
        }
        catch
        {
            return null;
        }
    }

    public static void MapCogitaCoreRuntimeEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/libraries/{libraryId:guid}/runs", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            CreateCoreRunRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var roleId = await dbContext.CogitaLibraries.AsNoTracking()
                .Where(x => x.Id == libraryId)
                .Select(x => x.RoleId)
                .FirstOrDefaultAsync(ct);
            if (roleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "Library role is missing." });
            }

            var revisionPatternId = request.RevisionPatternId ?? Guid.Empty;
            if (revisionPatternId == Guid.Empty)
            {
                revisionPatternId = await dbContext.CogitaRevisionPatternsCore.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && !x.IsArchived)
                    .OrderByDescending(x => x.UpdatedUtc)
                    .Select(x => x.Id)
                    .FirstOrDefaultAsync(ct);
            }

            if (revisionPatternId == Guid.Empty)
            {
                var autoPattern = new CogitaRevisionPatternCore
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    RoleId = roleId,
                    Name = "Revision runtime pattern",
                    Mode = "random-once",
                    SettingsJson = "{}",
                    CollectionScopeJson = "{}",
                    IsArchived = false,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaRevisionPatternsCore.Add(autoPattern);
                revisionPatternId = autoPattern.Id;
            }
            else
            {
                var patternExists = await dbContext.CogitaRevisionPatternsCore.AsNoTracking()
                    .AnyAsync(x => x.Id == revisionPatternId && x.LibraryId == libraryId && !x.IsArchived, ct);
                if (!patternExists)
                {
                    return Results.BadRequest(new { error = "Revision pattern does not exist in library." });
                }
            }

            var runScope = CogitaCorePolicies.NormalizeRunScope(request.RunScope);
            var status = CogitaCorePolicies.NormalizeRunStatus(request.Status ?? "lobby");
            var normalizedTitle = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim();
            var settingsJson = NormalizeJson(request.SettingsJson);

            var run = new CogitaRevisionRun
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RevisionPatternId = revisionPatternId,
                RunScope = runScope,
                Title = normalizedTitle,
                Status = status,
                SettingsJson = settingsJson,
                PromptBundleJson = NormalizeJson(request.PromptBundleJson),
                StartedUtc = status == "active" ? now : null,
                FinishedUtc = status == "finished" ? now : null,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaRevisionRuns.Add(run);

            dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = run.Id,
                EventType = "run_created",
                PayloadJson = JsonSerializer.Serialize(new
                {
                    runScope,
                    status,
                    title = run.Title,
                    revisionPatternId
                }),
                CreatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CoreRunSummaryResponse(
                run.Id,
                run.LibraryId,
                run.RevisionPatternId,
                run.RunScope,
                run.Title,
                run.Status,
                run.CreatedUtc,
                run.UpdatedUtc,
                0,
                0));
        });

        group.MapPost("/libraries/{libraryId:guid}/runs/{runId:guid}/participants", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            JoinCoreRunRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var run = await dbContext.CogitaRevisionRuns
                .FirstOrDefaultAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (run is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? "Participant" : request.DisplayName.Trim();
            var normalizedPersonRoleId = request.PersonRoleId.HasValue && request.PersonRoleId.Value != Guid.Empty
                ? request.PersonRoleId
                : null;
            var isSharedScope = string.Equals(run.RunScope, "shared", StringComparison.Ordinal);
            var recoveryTokenRequest = string.IsNullOrWhiteSpace(request.RecoveryToken)
                ? null
                : request.RecoveryToken.Trim();
            var participantRecovered = false;

            CogitaRunParticipantCore? participant = null;
            if (isSharedScope && !string.IsNullOrWhiteSpace(recoveryTokenRequest))
            {
                var requestedTokenHash = HashRecoveryToken(recoveryTokenRequest);
                var candidates = await dbContext.CogitaRunParticipantsCore
                    .Where(x => x.RunId == runId && x.AccessTokenHash != null)
                    .ToListAsync(ct);

                participant = candidates.FirstOrDefault(x =>
                    x.AccessTokenHash is not null && x.AccessTokenHash.SequenceEqual(requestedTokenHash));
                if (participant is not null)
                {
                    var expiresUtc = ParseRecoveryExpirationUtc(participant.AccessTokenCipher);
                    if (!expiresUtc.HasValue || expiresUtc.Value <= now)
                    {
                        participant = null;
                    }
                    else
                    {
                        participantRecovered = true;
                        participant.IsConnected = true;
                        participant.UpdatedUtc = now;
                        if (normalizedPersonRoleId.HasValue)
                        {
                            participant.PersonRoleId = normalizedPersonRoleId;
                        }
                        if (!string.IsNullOrWhiteSpace(request.DisplayName))
                        {
                            participant.DisplayNameCipher = displayName;
                        }
                        participant.IsHost = participant.IsHost || request.IsHost;
                    }
                }
            }

            if (participant is null)
            {
                participant = new CogitaRunParticipantCore
                {
                    Id = Guid.NewGuid(),
                    RunId = runId,
                    PersonRoleId = normalizedPersonRoleId,
                    DisplayNameCipher = displayName,
                    IsHost = request.IsHost,
                    IsConnected = true,
                    JoinedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaRunParticipantsCore.Add(participant);
            }

            string? recoveryToken = null;
            DateTimeOffset? recoveryExpiresUtc = null;
            if (isSharedScope)
            {
                recoveryToken = GenerateRecoveryToken();
                recoveryExpiresUtc = now.Add(SharedRecoveryTtl);
                participant.AccessTokenHash = HashRecoveryToken(recoveryToken);
                participant.AccessTokenCipher = JsonSerializer.Serialize(new
                {
                    expUtc = recoveryExpiresUtc
                });
            }
            else
            {
                participant.AccessTokenHash = null;
                participant.AccessTokenCipher = null;
            }

            dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = runId,
                ParticipantId = participant.Id,
                EventType = participantRecovered ? "participant_recovered" : "participant_joined",
                PayloadJson = JsonSerializer.Serialize(new
                {
                    participantId = participant.Id,
                    participant.PersonRoleId,
                    displayName = participant.DisplayNameCipher,
                    participant.IsHost,
                    runScope = run.RunScope,
                    recovered = participantRecovered
                }),
                CreatedUtc = now
            });

            run.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CoreRunParticipantResponse(
                participant.Id,
                participant.RunId,
                participant.PersonRoleId,
                participant.DisplayNameCipher,
                participant.IsHost,
                participant.IsConnected,
                participant.JoinedUtc,
                participant.UpdatedUtc,
                recoveryToken,
                recoveryExpiresUtc));
        });

        group.MapPost("/libraries/{libraryId:guid}/runs/{runId:guid}/status", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            SetCoreRunStatusRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var run = await dbContext.CogitaRevisionRuns
                .FirstOrDefaultAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (run is null)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var status = CogitaCorePolicies.NormalizeRunStatus(request.Status);
            run.Status = status;
            run.UpdatedUtc = now;
            if (status == "active" && !run.StartedUtc.HasValue)
            {
                run.StartedUtc = now;
            }
            if ((status == "finished" || status == "archived") && !run.FinishedUtc.HasValue)
            {
                run.FinishedUtc = now;
            }

            dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = runId,
                EventType = "run_status_changed",
                PayloadJson = JsonSerializer.Serialize(new
                {
                    status,
                    request.Reason
                }),
                CreatedUtc = now
            });

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new CoreRunStatusResponse(run.Id, run.Status, run.StartedUtc, run.FinishedUtc, run.UpdatedUtc));
        });

        group.MapGet("/libraries/{libraryId:guid}/runs/{runId:guid}/runtime/state", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            Guid? participantId,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var run = await dbContext.CogitaRevisionRuns.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (run is null)
            {
                return Results.NotFound();
            }

            var participants = await dbContext.CogitaRunParticipantsCore.AsNoTracking()
                .Where(x => x.RunId == runId)
                .OrderBy(x => x.JoinedUtc)
                .Select(x => new CoreRunParticipantResponse(
                    x.Id,
                    x.RunId,
                    x.PersonRoleId,
                    x.DisplayNameCipher,
                    x.IsHost,
                    x.IsConnected,
                    x.JoinedUtc,
                    x.UpdatedUtc,
                    null,
                    null))
                .ToListAsync(ct);

            var cardsTotal = await dbContext.CogitaCheckcardDefinitionsCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.IsActive)
                .CountAsync(ct);

            var attemptsTotal = await dbContext.CogitaRunAttempts.AsNoTracking()
                .Where(x => x.RunId == runId)
                .CountAsync(ct);

            var eventsTotal = await dbContext.CogitaRunEventsCore.AsNoTracking()
                .Where(x => x.RunId == runId)
                .CountAsync(ct);

            var participantProgress = new CoreRunParticipantProgressResponse(0, 0, 0, 0, 0);
            if (participantId.HasValue && participantId.Value != Guid.Empty)
            {
                var rows = await dbContext.CogitaRunAttempts.AsNoTracking()
                    .Where(x => x.RunId == runId && x.ParticipantId == participantId.Value)
                    .ToListAsync(ct);
                var correct = rows.Count(x => CogitaKnownessCore.NormalizeOutcomeClass(x.OutcomeClass) == "correct");
                var wrong = rows.Count(x => CogitaKnownessCore.NormalizeOutcomeClass(x.OutcomeClass) == "wrong");
                var blank = rows.Count(x => CogitaKnownessCore.NormalizeOutcomeClass(x.OutcomeClass) == "blank_timeout");
                participantProgress = new CoreRunParticipantProgressResponse(
                    rows.Count,
                    correct,
                    wrong,
                    blank,
                    cardsTotal > 0 ? Math.Round(Math.Min(100d, rows.Count / (double)cardsTotal * 100d), 2) : 0d);
            }

            return Results.Ok(new CoreRunStateResponse(
                new CoreRunSummaryResponse(
                    run.Id,
                    run.LibraryId,
                    run.RevisionPatternId,
                    run.RunScope,
                    run.Title,
                    run.Status,
                    run.CreatedUtc,
                    run.UpdatedUtc,
                    participants.Count,
                    cardsTotal),
                participants,
                participantProgress,
                attemptsTotal,
                eventsTotal));
        });

        group.MapPost("/libraries/{libraryId:guid}/runs/{runId:guid}/runtime/next-card", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            CoreNextCardRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var run = await dbContext.CogitaRevisionRuns.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (run is null)
            {
                return Results.NotFound();
            }

            var participant = await dbContext.CogitaRunParticipantsCore.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.ParticipantId && x.RunId == runId, ct);
            if (participant is null)
            {
                return Results.BadRequest(new { error = "Participant is not part of this run." });
            }

            var cards = await dbContext.CogitaCheckcardDefinitionsCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.IsActive)
                .OrderBy(x => x.CardKey)
                .Select(x => new CoreCardRow(x.Id, x.CardKey))
                .ToListAsync(ct);
            if (cards.Count == 0)
            {
                return Results.Ok(new CoreNextCardResponse(null, null, "no-cards", Array.Empty<string>(), 0, 0));
            }

            var answeredRoundIndexes = await dbContext.CogitaRunAttempts.AsNoTracking()
                .Where(x => x.RunId == runId && x.ParticipantId == request.ParticipantId)
                .Select(x => x.RoundIndex)
                .ToListAsync(ct);
            var answeredRoundIndexSet = answeredRoundIndexes.ToHashSet();

            var knownessByCard = await LoadKnownessMapForSelectionAsync(dbContext, libraryId, run, participant.Id, ct);
            var cardById = cards.ToDictionary(x => x.Id, x => x.CardKey);
            var cardByIndex = cards.Select((card, index) => (card, index))
                .ToDictionary(x => x.index, x => x.card);

            var edges = await dbContext.CogitaDependencyEdgesCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId)
                .ToListAsync(ct);
            var edgesByChild = edges
                .GroupBy(x => x.ChildCardId)
                .ToDictionary(grouping => grouping.Key, grouping => grouping.ToList());

            var latestStackEvent = await dbContext.CogitaRunEventsCore.AsNoTracking()
                .Where(x => x.RunId == runId && x.ParticipantId == participant.Id && x.EventType == "stack_built")
                .OrderByDescending(x => x.CreatedUtc)
                .FirstOrDefaultAsync(ct);
            var parsedStackPayload = SafeParseStackPayload(latestStackEvent?.PayloadJson);
            var activeStackRoundIndexes = parsedStackPayload.RoundIndexes
                .Where(index => index >= 0 && index < cards.Count && !answeredRoundIndexSet.Contains(index))
                .Distinct()
                .ToList();

            var candidateRoundIndexes = new List<int>();
            var blockedCount = 0;
            var reasonByRoundIndex = new Dictionary<int, List<string>>();
            var stackCycleUsed = 0;
            if (activeStackRoundIndexes.Count > 0)
            {
                stackCycleUsed = parsedStackPayload.Cycle <= 0 ? 1 : parsedStackPayload.Cycle;
                blockedCount = Math.Max(0, parsedStackPayload.BlockedCount ?? 0);
                candidateRoundIndexes.AddRange(activeStackRoundIndexes);
                foreach (var roundIndex in activeStackRoundIndexes)
                {
                    reasonByRoundIndex[roundIndex] = new List<string>
                    {
                        $"stack:cycle:{stackCycleUsed}",
                        "dependency:locked-in-cycle"
                    };
                }
            }
            else
            {
                for (var index = 0; index < cards.Count; index++)
                {
                    if (answeredRoundIndexSet.Contains(index))
                    {
                        continue;
                    }

                    var card = cardByIndex[index];
                    var blocked = false;
                    var reasons = new List<string>();
                    if (edgesByChild.TryGetValue(card.Id, out var dependencies))
                    {
                        foreach (var edge in dependencies)
                        {
                            if (!cardById.TryGetValue(edge.ParentCardId, out var parentCardKey))
                            {
                                continue;
                            }

                            var parentKnowness = knownessByCard.TryGetValue(parentCardKey, out var value) ? value : 0d;
                            var threshold = (double)edge.ThresholdPct;
                            if (parentKnowness + 0.0001d < threshold)
                            {
                                var hardSoft = edge.IsHardBlock ? "hard" : "soft";
                                reasons.Add($"dependency:{hardSoft}:{parentCardKey}:{Math.Round(parentKnowness, 2)}/{Math.Round(threshold, 2)}");
                                blocked |= edge.IsHardBlock;
                            }
                        }
                    }

                    if (blocked)
                    {
                        blockedCount++;
                        reasonByRoundIndex[index] = reasons;
                        continue;
                    }

                    candidateRoundIndexes.Add(index);
                    if (reasons.Count > 0)
                    {
                        reasonByRoundIndex[index] = reasons;
                    }
                }

                if (candidateRoundIndexes.Count > 0)
                {
                    stackCycleUsed = Math.Max(1, parsedStackPayload.Cycle + 1);
                    dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
                    {
                        Id = Guid.NewGuid(),
                        LibraryId = libraryId,
                        RunId = runId,
                        ParticipantId = participant.Id,
                        EventType = "stack_built",
                        PayloadJson = JsonSerializer.Serialize(new
                        {
                            cycle = stackCycleUsed,
                            roundIndexes = candidateRoundIndexes,
                            blockedCount,
                            totalCards = cards.Count
                        }, JsonOptions),
                        CreatedUtc = DateTimeOffset.UtcNow
                    });
                }
            }

            if (candidateRoundIndexes.Count == 0)
            {
                if (answeredRoundIndexSet.Count >= cards.Count)
                {
                    return Results.Ok(new CoreNextCardResponse(null, null, "finished", Array.Empty<string>(), cards.Count, 0));
                }

                var firstReason = reasonByRoundIndex.OrderBy(x => x.Key).SelectMany(x => x.Value).Take(6).ToArray();
                return Results.Ok(new CoreNextCardResponse(null, null, "dependency-blocked", firstReason, cards.Count, blockedCount));
            }

            var patternMode = await dbContext.CogitaRevisionPatternsCore.AsNoTracking()
                .Where(x => x.Id == run.RevisionPatternId)
                .Select(x => x.Mode)
                .FirstOrDefaultAsync(ct);

            var knownessByRound = new Dictionary<int, double>();
            for (var index = 0; index < cards.Count; index++)
            {
                var card = cards[index];
                knownessByRound[index] = knownessByCard.TryGetValue(card.CardKey, out var value) ? value : 0d;
            }

            var selectionMode = string.IsNullOrWhiteSpace(patternMode)
                ? CogitaRunSelectionCore.NormalizeMode(run.RunScope)
                : CogitaRunSelectionCore.NormalizeMode(patternMode);
            var participantSeed = request.ParticipantSeed == Guid.Empty ? request.ParticipantId : request.ParticipantSeed;
            var orderedRoundIndexes = CogitaRunSelectionCore.OrderRemainingRoundIndexes(
                candidateRoundIndexes,
                participantSeed,
                selectionMode,
                knownessByRound);

            if (orderedRoundIndexes.Count == 0)
            {
                return Results.Ok(new CoreNextCardResponse(null, null, "finished", Array.Empty<string>(), cards.Count, blockedCount));
            }

            var nextRoundIndex = orderedRoundIndexes[0];
            var nextCard = cards[nextRoundIndex];
            var reasonTrace = new List<string>
            {
                $"selection:{selectionMode}",
                $"knowness:{Math.Round(knownessByRound[nextRoundIndex], 2)}"
            };
            if (stackCycleUsed > 0)
            {
                reasonTrace.Add($"stack:cycle:{stackCycleUsed}");
            }
            if (reasonByRoundIndex.TryGetValue(nextRoundIndex, out var extraReasons))
            {
                reasonTrace.AddRange(extraReasons);
            }

            dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = runId,
                ParticipantId = participant.Id,
                EventType = "card_selected",
                RoundIndex = nextRoundIndex,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    nextCard.CardKey,
                    mode = selectionMode,
                    reasons = reasonTrace
                }),
                CreatedUtc = DateTimeOffset.UtcNow
            });
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CoreNextCardResponse(
                nextCard.CardKey,
                nextRoundIndex,
                "selected",
                reasonTrace,
                cards.Count,
                blockedCount));
        });

        group.MapPost("/libraries/{libraryId:guid}/runs/{runId:guid}/runtime/attempt", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            CoreRunAttemptRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var run = await dbContext.CogitaRevisionRuns
                .FirstOrDefaultAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (run is null)
            {
                return Results.NotFound();
            }

            var participant = await dbContext.CogitaRunParticipantsCore
                .FirstOrDefaultAsync(x => x.Id == request.ParticipantId && x.RunId == runId, ct);
            if (participant is null)
            {
                return Results.BadRequest(new { error = "Participant is not part of this run." });
            }

            var normalizedCardKey = (request.CardKey ?? string.Empty).Trim();
            if (normalizedCardKey.Length == 0)
            {
                return Results.BadRequest(new { error = "cardKey is required." });
            }

            var cardDefinition = await dbContext.CogitaCheckcardDefinitionsCore.AsNoTracking()
                .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.CardKey == normalizedCardKey, ct);
            if (cardDefinition is null)
            {
                return Results.BadRequest(new { error = "Card does not exist in library." });
            }

            var now = DateTimeOffset.UtcNow;
            var outcomeClass = CogitaKnownessCore.NormalizeOutcomeClass(request.OutcomeClass);
            var revealedUtc = request.RevealedUtc ?? now;
            var promptShownUtc = request.PromptShownUtc ?? now;
            var correctAnswerForDiagnostics = ExtractCorrectAnswer(cardDefinition.RevealJson);
            var charComparison = BuildCharComparison(request.Answer, correctAnswerForDiagnostics);

            var exposure = await dbContext.CogitaRunExposures
                .FirstOrDefaultAsync(
                    x => x.RunId == runId && x.ParticipantId == request.ParticipantId && x.RoundIndex == request.RoundIndex,
                    ct);
            if (exposure is null)
            {
                exposure = new CogitaRunExposure
                {
                    Id = Guid.NewGuid(),
                    RunId = runId,
                    ParticipantId = request.ParticipantId,
                    RoundIndex = request.RoundIndex,
                    CardKey = normalizedCardKey,
                    PromptShownUtc = promptShownUtc,
                    RevealShownUtc = revealedUtc,
                    WasSkipped = outcomeClass == "blank_timeout",
                    CreatedUtc = now
                };
                dbContext.CogitaRunExposures.Add(exposure);
            }
            else
            {
                exposure.CardKey = normalizedCardKey;
                exposure.RevealShownUtc = revealedUtc;
                exposure.WasSkipped = outcomeClass == "blank_timeout";
            }

            var streakCountBeforeAttempt = await CountCurrentCorrectStreakAsync(dbContext, runId, request.ParticipantId, ct);
            var scoreFactors = BuildScoreFactors(outcomeClass, request.ResponseDurationMs, streakCountBeforeAttempt + 1);
            var totalPoints = scoreFactors.Sum(x => x.Points);

            var attempt = new CogitaRunAttempt
            {
                Id = Guid.NewGuid(),
                RunId = runId,
                ParticipantId = request.ParticipantId,
                RoundIndex = request.RoundIndex,
                CardKey = normalizedCardKey,
                AnswerCipher = string.IsNullOrWhiteSpace(request.Answer) ? null : request.Answer,
                OutcomeClass = outcomeClass,
                IsAnswered = outcomeClass != "blank_timeout",
                IsCorrect = outcomeClass == "correct" ? true : outcomeClass == "wrong" ? false : null,
                CorrectnessPct = outcomeClass == "correct" ? 100m : outcomeClass == "blank_timeout" ? 15m : 0m,
                SubmittedUtc = now,
                RevealedUtc = revealedUtc,
                ResponseDurationMs = request.ResponseDurationMs,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaRunAttempts.Add(attempt);

            dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = runId,
                ParticipantId = request.ParticipantId,
                EventType = "attempt_recorded",
                RoundIndex = request.RoundIndex,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    attemptId = attempt.Id,
                    cardKey = normalizedCardKey,
                    outcomeClass,
                    responseDurationMs = request.ResponseDurationMs,
                    totalPoints,
                    scoreFactors,
                    charComparison
                }, JsonOptions),
                CreatedUtc = now
            });

            dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = runId,
                ParticipantId = request.ParticipantId,
                EventType = "reveal_shown",
                RoundIndex = request.RoundIndex,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    cardKey = normalizedCardKey,
                    revealedUtc
                }, JsonOptions),
                CreatedUtc = now
            });

            run.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            var knownessUpdate = await UpdateKnownessForAttemptAsync(
                dbContext,
                libraryId,
                runId,
                participant,
                normalizedCardKey,
                outcomeClass,
                now,
                ct);
            await dbContext.SaveChangesAsync(ct);

            var reveal = await BuildRevealResponseAsync(
                dbContext,
                runId,
                request.ParticipantId,
                request.RoundIndex,
                normalizedCardKey,
                scoreFactors,
                totalPoints,
                ct);

            return Results.Ok(new CoreRunAttemptResponse(
                attempt.Id,
                attempt.RunId,
                attempt.ParticipantId,
                attempt.RoundIndex,
                attempt.CardKey,
                attempt.OutcomeClass,
                attempt.SubmittedUtc,
                attempt.RevealedUtc,
                attempt.ResponseDurationMs,
                totalPoints,
                scoreFactors,
                reveal,
                charComparison,
                knownessUpdate.Snapshot,
                knownessUpdate.Propagation));
        });

        group.MapGet("/libraries/{libraryId:guid}/runs/{runId:guid}/runtime/reveal", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            Guid participantId,
            int roundIndex,
            string? cardKey,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var runExists = await dbContext.CogitaRevisionRuns.AsNoTracking()
                .AnyAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (!runExists)
            {
                return Results.NotFound();
            }

            var normalizedCardKey = (cardKey ?? string.Empty).Trim();
            if (normalizedCardKey.Length == 0)
            {
                normalizedCardKey = await dbContext.CogitaRunAttempts.AsNoTracking()
                    .Where(x => x.RunId == runId && x.ParticipantId == participantId && x.RoundIndex == roundIndex)
                    .OrderByDescending(x => x.SubmittedUtc)
                    .Select(x => x.CardKey)
                    .FirstOrDefaultAsync(ct) ?? string.Empty;
            }
            if (normalizedCardKey.Length == 0)
            {
                return Results.NotFound();
            }

            var reveal = await BuildRevealResponseAsync(
                dbContext,
                runId,
                participantId,
                roundIndex,
                normalizedCardKey,
                Array.Empty<CoreScoreFactorResponse>(),
                0,
                ct);
            return Results.Ok(reveal);
        });

        group.MapGet("/libraries/{libraryId:guid}/runs/{runId:guid}/runtime/statistics", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var run = await dbContext.CogitaRevisionRuns.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (run is null)
            {
                return Results.NotFound();
            }

            var participants = await dbContext.CogitaRunParticipantsCore.AsNoTracking()
                .Where(x => x.RunId == runId)
                .ToListAsync(ct);
            var participantLabelById = participants.ToDictionary(x => x.Id, x => x.DisplayNameCipher);

            var participantStats = new Dictionary<Guid, MutableParticipantStats>();
            foreach (var participant in participants)
            {
                participantStats[participant.Id] = new MutableParticipantStats
                {
                    ParticipantId = participant.Id,
                    DisplayName = participant.DisplayNameCipher
                };
            }

            var timeline = new List<CoreRunTimelineItemResponse>();
            var attemptEvents = await dbContext.CogitaRunEventsCore.AsNoTracking()
                .Where(x => x.RunId == runId && x.EventType == "attempt_recorded")
                .OrderBy(x => x.CreatedUtc)
                .ToListAsync(ct);

            var index = 0;
            var totalAttempts = 0;
            var totalCorrect = 0;
            var totalWrong = 0;
            var totalBlank = 0;
            var totalPoints = 0;
            foreach (var evt in attemptEvents)
            {
                if (!evt.ParticipantId.HasValue || evt.ParticipantId.Value == Guid.Empty)
                {
                    continue;
                }

                var participantId = evt.ParticipantId.Value;
                if (!participantStats.TryGetValue(participantId, out var stats))
                {
                    stats = new MutableParticipantStats
                    {
                        ParticipantId = participantId,
                        DisplayName = participantLabelById.TryGetValue(participantId, out var label) ? label : participantId.ToString("D")
                    };
                    participantStats[participantId] = stats;
                }

                var payload = SafeParseEventPayload(evt.PayloadJson);
                var outcomeClass = CogitaKnownessCore.NormalizeOutcomeClass(payload.OutcomeClass);
                var points = payload.TotalPoints;
                var durationMs = payload.ResponseDurationMs;
                var cardKey = payload.CardKey;

                stats.AttemptCount++;
                stats.TotalPoints += points;
                stats.TotalDurationMs += durationMs;
                stats.DurationCount += durationMs > 0 ? 1 : 0;
                switch (outcomeClass)
                {
                    case "correct":
                        stats.CorrectCount++;
                        totalCorrect++;
                        break;
                    case "blank_timeout":
                        stats.BlankCount++;
                        totalBlank++;
                        break;
                    default:
                        stats.WrongCount++;
                        totalWrong++;
                        break;
                }

                totalAttempts++;
                totalPoints += points;
                timeline.Add(new CoreRunTimelineItemResponse(
                    index++,
                    evt.CreatedUtc,
                    participantId,
                    stats.DisplayName,
                    evt.RoundIndex,
                    cardKey,
                    outcomeClass,
                    points,
                    durationMs));
            }

            var participantResponses = participantStats.Values
                .OrderByDescending(x => x.TotalPoints)
                .ThenByDescending(x => x.AttemptCount)
                .Select(x => new CoreRunParticipantStatisticsResponse(
                    x.ParticipantId,
                    x.DisplayName,
                    x.AttemptCount,
                    x.CorrectCount,
                    x.WrongCount,
                    x.BlankCount,
                    x.AttemptCount > 0 ? Math.Round((x.CorrectCount + (x.BlankCount * 0.15d)) / x.AttemptCount * 100d, 2) : 0d,
                    x.TotalPoints,
                    x.DurationCount > 0 ? Math.Round(x.TotalDurationMs / (double)x.DurationCount, 2) : 0d))
                .ToList();

            return Results.Ok(new CoreRunStatisticsResponse(
                run.Id,
                run.RunScope,
                run.Status,
                totalAttempts,
                totalCorrect,
                totalWrong,
                totalBlank,
                Math.Round(Math.Max(0d, Math.Min(100d, totalAttempts > 0
                    ? ((totalCorrect + totalBlank * 0.15d) / totalAttempts) * 100d
                    : 0d)), 2),
                totalPoints,
                participantResponses,
                timeline));
        });

        group.MapPost("/libraries/{libraryId:guid}/runs/{runId:guid}/runtime/events", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid runId,
            CoreRunEventAppendRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var run = await dbContext.CogitaRevisionRuns
                .FirstOrDefaultAsync(x => x.Id == runId && x.LibraryId == libraryId, ct);
            if (run is null)
            {
                return Results.NotFound();
            }

            var participantId = request.ParticipantId.HasValue && request.ParticipantId.Value != Guid.Empty
                ? request.ParticipantId
                : null;
            if (participantId.HasValue)
            {
                var participantExists = await dbContext.CogitaRunParticipantsCore.AsNoTracking()
                    .AnyAsync(x => x.Id == participantId.Value && x.RunId == runId, ct);
                if (!participantExists)
                {
                    return Results.BadRequest(new { error = "Participant is not part of this run." });
                }
            }

            var now = DateTimeOffset.UtcNow;
            var eventType = string.IsNullOrWhiteSpace(request.EventType) ? "custom" : request.EventType.Trim().ToLowerInvariant();
            var payloadJson = NormalizeJson(request.PayloadJson);
            var evt = new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = runId,
                ParticipantId = participantId,
                EventType = eventType,
                RoundIndex = request.RoundIndex,
                PayloadJson = payloadJson,
                CreatedUtc = now
            };
            dbContext.CogitaRunEventsCore.Add(evt);
            run.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CoreRunEventResponse(evt.Id, evt.RunId, evt.ParticipantId, evt.EventType, evt.RoundIndex, evt.PayloadJson, evt.CreatedUtc));
        });

        group.MapPost("/libraries/{libraryId:guid}/legacy/review-outcomes/sync", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IKeyRingService keyRingService,
            Guid libraryId,
            LegacyReviewOutcomeSyncRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            if (!EndpointHelpers.TryGetUserId(context, out var userId))
            {
                return Results.Unauthorized();
            }
            if (!EndpointHelpers.TryGetSessionId(context, out var sessionId))
            {
                return Results.Unauthorized();
            }

            if (request.Outcomes is null || request.Outcomes.Count == 0)
            {
                return Results.BadRequest(new { error = "Outcomes list is empty." });
            }

            var library = await dbContext.CogitaLibraries.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == libraryId, ct);
            if (library is null)
            {
                return Results.NotFound();
            }

            RoleKeyRing keyRing;
            try
            {
                keyRing = await keyRingService.BuildRoleKeyRingAsync(context, userId, sessionId, ct);
            }
            catch (InvalidOperationException)
            {
                return Results.StatusCode(StatusCodes.Status428PreconditionRequired);
            }

            if (!keyRing.WriteKeys.ContainsKey(library.RoleId))
            {
                return Results.Forbid();
            }

            var account = await dbContext.UserAccounts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == userId, ct);
            if (account is null)
            {
                return Results.NotFound();
            }

            var sync = await SyncLegacyReviewOutcomesToCoreAsync(
                dbContext,
                libraryId,
                library.RoleId,
                account.MasterRoleId,
                keyRing.WriteKeys.Keys,
                request.Outcomes,
                ct);
            return Results.Ok(sync);
        });

        group.MapPost("/libraries/{libraryId:guid}/creation-projects/{projectId:guid}/artifacts", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid projectId,
            CreateCoreCreationArtifactRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var projectExists = await dbContext.CogitaCreationProjects.AsNoTracking()
                .AnyAsync(x => x.Id == projectId && x.LibraryId == libraryId, ct);
            if (!projectExists)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var artifact = new CogitaCreationArtifact
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                ProjectId = projectId,
                ArtifactType = string.IsNullOrWhiteSpace(request.ArtifactType) ? "artifact" : request.ArtifactType.Trim().ToLowerInvariant(),
                Name = string.IsNullOrWhiteSpace(request.Name) ? "Artifact" : request.Name.Trim(),
                ContentJson = NormalizeJson(request.ContentJson),
                SourceItemId = request.SourceItemId.HasValue && request.SourceItemId.Value != Guid.Empty
                    ? request.SourceItemId
                    : null,
                SourceCardKey = string.IsNullOrWhiteSpace(request.SourceCardKey) ? null : request.SourceCardKey.Trim(),
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaCreationArtifacts.Add(artifact);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CoreCreationArtifactResponse(
                artifact.Id,
                artifact.LibraryId,
                artifact.ProjectId,
                artifact.ArtifactType,
                artifact.Name,
                artifact.ContentJson,
                artifact.SourceItemId,
                artifact.SourceCardKey,
                artifact.CreatedUtc,
                artifact.UpdatedUtc));
        });

        group.MapGet("/libraries/{libraryId:guid}/creation-projects/{projectId:guid}/artifacts", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid projectId,
            int? limit,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var normalizedLimit = Math.Clamp(limit ?? 200, 1, 2000);
            var rows = await dbContext.CogitaCreationArtifacts.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.ProjectId == projectId)
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(normalizedLimit)
                .Select(x => new CoreCreationArtifactResponse(
                    x.Id,
                    x.LibraryId,
                    x.ProjectId,
                    x.ArtifactType,
                    x.Name,
                    x.ContentJson,
                    x.SourceItemId,
                    x.SourceCardKey,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapPost("/libraries/{libraryId:guid}/crypto/reference-fields", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IHashingService hashingService,
            Guid libraryId,
            UpsertCoreReferenceCryptoFieldRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var ownerEntity = (request.OwnerEntity ?? string.Empty).Trim().ToLowerInvariant();
            var fieldKey = (request.FieldKey ?? string.Empty).Trim().ToLowerInvariant();
            if (ownerEntity.Length == 0 || request.OwnerId == Guid.Empty || fieldKey.Length == 0)
            {
                return Results.BadRequest(new { error = "ownerEntity, ownerId and fieldKey are required." });
            }

            var sourceValue = string.IsNullOrWhiteSpace(request.PlainValue)
                ? (request.ValueCipher ?? string.Empty)
                : request.PlainValue;
            if (string.IsNullOrWhiteSpace(sourceValue))
            {
                return Results.BadRequest(new { error = "plainValue or valueCipher is required." });
            }

            var normalizedValue = sourceValue.Trim();
            var deterministicHash = hashingService.Hash(Encoding.UTF8.GetBytes(normalizedValue));
            var valueCipher = string.IsNullOrWhiteSpace(request.ValueCipher)
                ? Convert.ToBase64String(Encoding.UTF8.GetBytes(normalizedValue))
                : request.ValueCipher!.Trim();
            var now = DateTimeOffset.UtcNow;

            var field = await dbContext.CogitaReferenceCryptoFields
                .FirstOrDefaultAsync(
                    x => x.LibraryId == libraryId && x.OwnerEntity == ownerEntity && x.OwnerId == request.OwnerId && x.FieldKey == fieldKey,
                    ct);
            if (field is null)
            {
                field = new CogitaReferenceCryptoField
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    OwnerEntity = ownerEntity,
                    OwnerId = request.OwnerId,
                    FieldKey = fieldKey,
                    PolicyVersion = string.IsNullOrWhiteSpace(request.PolicyVersion) ? "v1" : request.PolicyVersion.Trim(),
                    ValueCipher = valueCipher,
                    DeterministicHash = deterministicHash,
                    SignatureBase64 = string.IsNullOrWhiteSpace(request.SignatureBase64) ? null : request.SignatureBase64.Trim(),
                    Signer = string.IsNullOrWhiteSpace(request.Signer) ? null : request.Signer.Trim(),
                    SignatureVersion = string.IsNullOrWhiteSpace(request.SignatureVersion) ? null : request.SignatureVersion.Trim(),
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaReferenceCryptoFields.Add(field);
            }
            else
            {
                field.PolicyVersion = string.IsNullOrWhiteSpace(request.PolicyVersion) ? field.PolicyVersion : request.PolicyVersion.Trim();
                field.ValueCipher = valueCipher;
                field.DeterministicHash = deterministicHash;
                field.SignatureBase64 = string.IsNullOrWhiteSpace(request.SignatureBase64) ? field.SignatureBase64 : request.SignatureBase64.Trim();
                field.Signer = string.IsNullOrWhiteSpace(request.Signer) ? field.Signer : request.Signer.Trim();
                field.SignatureVersion = string.IsNullOrWhiteSpace(request.SignatureVersion) ? field.SignatureVersion : request.SignatureVersion.Trim();
                field.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);
            return Results.Ok(new CoreReferenceCryptoFieldResponse(
                field.Id,
                field.LibraryId,
                field.OwnerEntity,
                field.OwnerId,
                field.FieldKey,
                field.PolicyVersion,
                field.ValueCipher,
                Convert.ToBase64String(field.DeterministicHash),
                field.SignatureBase64,
                field.Signer,
                field.SignatureVersion,
                field.CreatedUtc,
                field.UpdatedUtc));
        });

        group.MapGet("/libraries/{libraryId:guid}/crypto/reference-fields/search", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IHashingService hashingService,
            Guid libraryId,
            string fieldKey,
            string q,
            int? limit,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var normalizedFieldKey = (fieldKey ?? string.Empty).Trim().ToLowerInvariant();
            var query = (q ?? string.Empty).Trim();
            if (normalizedFieldKey.Length == 0 || query.Length == 0)
            {
                return Results.BadRequest(new { error = "fieldKey and q are required." });
            }

            var normalizedLimit = Math.Clamp(limit ?? 100, 1, 2000);
            var hash = hashingService.Hash(Encoding.UTF8.GetBytes(query));
            var rows = await dbContext.CogitaReferenceCryptoFields.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.FieldKey == normalizedFieldKey && x.DeterministicHash.SequenceEqual(hash))
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(normalizedLimit)
                .Select(x => new CoreReferenceCryptoFieldSearchResponse(
                    x.Id,
                    x.OwnerEntity,
                    x.OwnerId,
                    x.FieldKey,
                    x.PolicyVersion,
                    x.Signer,
                    x.SignatureVersion,
                    x.UpdatedUtc))
                .ToListAsync(ct);
            return Results.Ok(rows);
        });
    }

    internal static async Task<LegacyReviewOutcomeSyncResponse> SyncLegacyReviewOutcomesToCoreAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        Guid libraryRoleId,
        Guid fallbackPersonRoleId,
        IEnumerable<Guid> writableRoleIds,
        IReadOnlyList<LegacyReviewOutcomeSyncItem>? outcomes,
        CancellationToken ct)
    {
        if (outcomes is null || outcomes.Count == 0)
        {
            return new LegacyReviewOutcomeSyncResponse(0, 0);
        }

        var writableRoleIdSet = writableRoleIds.ToHashSet();
        if (writableRoleIdSet.Count == 0)
        {
            return new LegacyReviewOutcomeSyncResponse(0, outcomes.Count);
        }

        var patternsByMode = new Dictionary<string, CogitaRevisionPatternCore>(StringComparer.Ordinal);
        var runByKey = new Dictionary<string, CogitaRevisionRun>(StringComparer.Ordinal);
        var participantByRunAndRole = new Dictionary<string, CogitaRunParticipantCore>(StringComparer.Ordinal);
        var typeSpecByType = new Dictionary<string, CogitaKnowledgeTypeSpec>(StringComparer.Ordinal);
        var notionByLegacyKey = new Dictionary<string, CogitaNotion>(StringComparer.Ordinal);
        var checkcardByKey = new Dictionary<string, CogitaCheckcardDefinitionCore>(StringComparer.Ordinal);
        var requestAttemptKeys = new HashSet<string>(StringComparer.Ordinal);

        var synced = 0;
        var skipped = 0;

        foreach (var entry in outcomes)
        {
            var itemType = NormalizeLegacyItemType(entry.ItemType);
            if (itemType is null || entry.ItemId == Guid.Empty)
            {
                skipped++;
                continue;
            }

            var personRoleId = entry.PersonRoleId.HasValue && entry.PersonRoleId.Value != Guid.Empty
                ? entry.PersonRoleId.Value
                : fallbackPersonRoleId;
            if (!writableRoleIdSet.Contains(personRoleId))
            {
                skipped++;
                continue;
            }

            var revisionMode = NormalizeLegacyRevisionMode(entry.RevisionType);
            var clientToken = NormalizeLegacyClientToken(entry.ClientId);
            var runTitle = BuildLegacyRunTitle(personRoleId, clientToken, revisionMode);
            var runCacheKey = $"{personRoleId:N}:{runTitle}";

            var pattern = await EnsureLegacyRevisionPatternAsync(
                dbContext,
                libraryId,
                libraryRoleId,
                revisionMode,
                patternsByMode,
                ct);
            var run = await EnsureLegacyRunAsync(
                dbContext,
                libraryId,
                pattern.Id,
                runTitle,
                runByKey,
                runCacheKey,
                ct);
            var participant = await EnsureLegacyParticipantAsync(
                dbContext,
                libraryId,
                run,
                personRoleId,
                participantByRunAndRole,
                ct);

            var cardKey = BuildLegacyCardKey(itemType, entry.ItemId, entry.CheckType, entry.Direction);
            var roundIndex = Math.Max(0, entry.ClientSequence);
            var requestAttemptKey = $"{run.Id:N}:{participant.Id:N}:{roundIndex}:{cardKey}";
            if (!requestAttemptKeys.Add(requestAttemptKey))
            {
                skipped++;
                continue;
            }

            var attemptExists = await dbContext.CogitaRunAttempts.AsNoTracking()
                .AnyAsync(
                    x => x.RunId == run.Id &&
                         x.ParticipantId == participant.Id &&
                         x.RoundIndex == roundIndex &&
                         x.CardKey == cardKey,
                    ct);
            if (attemptExists)
            {
                skipped++;
                continue;
            }

            var typeSpec = await EnsureLegacyKnowledgeTypeSpecAsync(
                dbContext,
                libraryId,
                itemType,
                typeSpecByType,
                ct);
            var legacyItem = await EnsureLegacyNotionAsync(
                dbContext,
                libraryId,
                libraryRoleId,
                typeSpec,
                itemType,
                entry.ItemId,
                notionByLegacyKey,
                ct);
            _ = await EnsureLegacyCheckcardDefinitionAsync(
                dbContext,
                libraryId,
                legacyItem.Id,
                itemType,
                cardKey,
                entry.CheckType,
                entry.Direction,
                checkcardByKey,
                ct);

            var now = DateTimeOffset.UtcNow;
            var normalizedDurationMs = entry.DurationMs.HasValue ? Math.Max(0, entry.DurationMs.Value) : (int?)null;
            var promptShownUtc = normalizedDurationMs.HasValue ? now.AddMilliseconds(-normalizedDurationMs.Value) : now;
            var outcomeClass = entry.Correct ? "correct" : "wrong";

            var exposure = await dbContext.CogitaRunExposures
                .FirstOrDefaultAsync(
                    x => x.RunId == run.Id && x.ParticipantId == participant.Id && x.RoundIndex == roundIndex,
                    ct);
            if (exposure is null)
            {
                exposure = new CogitaRunExposure
                {
                    Id = Guid.NewGuid(),
                    RunId = run.Id,
                    ParticipantId = participant.Id,
                    RoundIndex = roundIndex,
                    CardKey = cardKey,
                    PromptShownUtc = promptShownUtc,
                    RevealShownUtc = now,
                    WasSkipped = outcomeClass == "blank_timeout",
                    CreatedUtc = now
                };
                dbContext.CogitaRunExposures.Add(exposure);
            }
            else
            {
                exposure.CardKey = cardKey;
                exposure.RevealShownUtc = now;
                exposure.WasSkipped = outcomeClass == "blank_timeout";
            }

            var streakCountBeforeAttempt = await CountCurrentCorrectStreakAsync(dbContext, run.Id, participant.Id, ct);
            var scoreFactors = BuildScoreFactors(outcomeClass, normalizedDurationMs, streakCountBeforeAttempt + 1);
            var totalPoints = scoreFactors.Sum(x => x.Points);

            var attempt = new CogitaRunAttempt
            {
                Id = Guid.NewGuid(),
                RunId = run.Id,
                ParticipantId = participant.Id,
                RoundIndex = roundIndex,
                CardKey = cardKey,
                AnswerCipher = null,
                OutcomeClass = outcomeClass,
                IsAnswered = true,
                IsCorrect = entry.Correct,
                CorrectnessPct = entry.Correct ? 100m : 0m,
                SubmittedUtc = now,
                RevealedUtc = now,
                ResponseDurationMs = normalizedDurationMs,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaRunAttempts.Add(attempt);

            dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = run.Id,
                ParticipantId = participant.Id,
                EventType = "attempt_recorded",
                RoundIndex = roundIndex,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    attemptId = attempt.Id,
                    cardKey,
                    outcomeClass,
                    responseDurationMs = normalizedDurationMs,
                    totalPoints,
                    scoreFactors,
                    legacy = new
                    {
                        itemType,
                        itemId = entry.ItemId,
                        entry.CheckType,
                        entry.Direction,
                        entry.RevisionType,
                        entry.EvalType,
                        entry.ClientId,
                        entry.ClientSequence
                    }
                }, JsonOptions),
                CreatedUtc = now
            });
            dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RunId = run.Id,
                ParticipantId = participant.Id,
                EventType = "reveal_shown",
                RoundIndex = roundIndex,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    cardKey,
                    revealedUtc = now
                }, JsonOptions),
                CreatedUtc = now
            });

            run.Status = "active";
            run.UpdatedUtc = now;
            if (!run.StartedUtc.HasValue)
            {
                run.StartedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);
            _ = await UpdateKnownessForAttemptAsync(
                dbContext,
                libraryId,
                run.Id,
                participant,
                cardKey,
                outcomeClass,
                now,
                ct);
            await dbContext.SaveChangesAsync(ct);

            synced++;
        }

        return new LegacyReviewOutcomeSyncResponse(synced, skipped);
    }

    private static string? NormalizeLegacyItemType(string? raw)
    {
        var normalized = (raw ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is "info" or "connection" ? normalized : null;
    }

    private static string NormalizeLegacyRevisionMode(string? raw)
    {
        var normalized = (raw ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "random" => "random",
            "random-once" => "random-once",
            "levels" => "levels",
            "temporal" => "temporal",
            "full-stack" => "full-stack",
            _ => "random"
        };
    }

    private static string NormalizeLegacyClientToken(string? raw)
    {
        var source = string.IsNullOrWhiteSpace(raw) ? "legacy-client" : raw.Trim();
        var chars = source
            .Select(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_' or '.' or ':' ? ch : '-')
            .ToArray();
        var normalized = new string(chars).Trim('-');
        if (normalized.Length == 0)
        {
            normalized = "legacy-client";
        }
        if (normalized.Length > 64)
        {
            normalized = normalized[..64];
        }
        return normalized;
    }

    private static string BuildLegacyRunTitle(Guid personRoleId, string clientToken, string revisionMode)
    {
        var title = $"legacy:{personRoleId:N}:{clientToken}:{revisionMode}";
        return title.Length <= 256 ? title : title[..256];
    }

    private static string BuildLegacyCardKey(string itemType, Guid itemId, string? checkType, string? direction)
    {
        var checkToken = string.IsNullOrWhiteSpace(checkType) ? "-" : checkType.Trim().ToLowerInvariant();
        var directionToken = string.IsNullOrWhiteSpace(direction) ? "-" : direction.Trim().ToLowerInvariant();
        var composed = $"{itemType}:{itemId:D}:{checkToken}:{directionToken}";
        return composed.Length <= 256 ? composed : composed[..256];
    }

    private static async Task<CogitaRevisionPatternCore> EnsureLegacyRevisionPatternAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        Guid roleId,
        string revisionMode,
        IDictionary<string, CogitaRevisionPatternCore> patternCache,
        CancellationToken ct)
    {
        if (patternCache.TryGetValue(revisionMode, out var cached))
        {
            return cached;
        }

        var existing = await dbContext.CogitaRevisionPatternsCore
            .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.Mode == revisionMode && !x.IsArchived, ct);
        if (existing is not null)
        {
            patternCache[revisionMode] = existing;
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var created = new CogitaRevisionPatternCore
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            RoleId = roleId,
            Name = $"Legacy {revisionMode} pattern",
            Mode = revisionMode,
            SettingsJson = "{\"source\":\"legacy-review-outcomes\"}",
            CollectionScopeJson = "{}",
            IsArchived = false,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.CogitaRevisionPatternsCore.Add(created);
        patternCache[revisionMode] = created;
        return created;
    }

    private static async Task<CogitaRevisionRun> EnsureLegacyRunAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        Guid revisionPatternId,
        string runTitle,
        IDictionary<string, CogitaRevisionRun> runCache,
        string runCacheKey,
        CancellationToken ct)
    {
        if (runCache.TryGetValue(runCacheKey, out var cached))
        {
            return cached;
        }

        var existing = await dbContext.CogitaRevisionRuns
            .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.Title == runTitle && x.RunScope == "solo", ct);
        if (existing is not null)
        {
            runCache[runCacheKey] = existing;
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var run = new CogitaRevisionRun
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            RevisionPatternId = revisionPatternId,
            RunScope = "solo",
            Title = runTitle,
            Status = "active",
            SettingsJson = "{\"source\":\"legacy-review-outcomes\"}",
            PromptBundleJson = "{}",
            StartedUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.CogitaRevisionRuns.Add(run);
        dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            RunId = run.Id,
            EventType = "run_created",
            PayloadJson = JsonSerializer.Serialize(new
            {
                runScope = run.RunScope,
                status = run.Status,
                title = run.Title,
                revisionPatternId
            }, JsonOptions),
            CreatedUtc = now
        });

        runCache[runCacheKey] = run;
        return run;
    }

    private static async Task<CogitaRunParticipantCore> EnsureLegacyParticipantAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        CogitaRevisionRun run,
        Guid personRoleId,
        IDictionary<string, CogitaRunParticipantCore> participantCache,
        CancellationToken ct)
    {
        var cacheKey = $"{run.Id:N}:{personRoleId:N}";
        if (participantCache.TryGetValue(cacheKey, out var cached))
        {
            return cached;
        }

        var existing = await dbContext.CogitaRunParticipantsCore
            .FirstOrDefaultAsync(x => x.RunId == run.Id && x.PersonRoleId == personRoleId, ct);
        if (existing is not null)
        {
            participantCache[cacheKey] = existing;
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var participant = new CogitaRunParticipantCore
        {
            Id = Guid.NewGuid(),
            RunId = run.Id,
            PersonRoleId = personRoleId,
            DisplayNameCipher = $"Role {personRoleId:N}",
            IsHost = false,
            IsConnected = true,
            JoinedUtc = now,
            UpdatedUtc = now
        };
        dbContext.CogitaRunParticipantsCore.Add(participant);
        dbContext.CogitaRunEventsCore.Add(new CogitaRunEventCore
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            RunId = run.Id,
            ParticipantId = participant.Id,
            EventType = "participant_joined",
            PayloadJson = JsonSerializer.Serialize(new
            {
                participantId = participant.Id,
                participant.PersonRoleId,
                displayName = participant.DisplayNameCipher,
                participant.IsHost,
                runScope = run.RunScope
            }, JsonOptions),
            CreatedUtc = now
        });

        participantCache[cacheKey] = participant;
        return participant;
    }

    private static async Task<CogitaKnowledgeTypeSpec> EnsureLegacyKnowledgeTypeSpecAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        string itemType,
        IDictionary<string, CogitaKnowledgeTypeSpec> typeSpecCache,
        CancellationToken ct)
    {
        if (typeSpecCache.TryGetValue(itemType, out var cached))
        {
            return cached;
        }

        var typeKey = itemType == "connection" ? "legacy.connection" : "legacy.info";
        var existing = await dbContext.CogitaKnowledgeTypeSpecs
            .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.TypeKey == typeKey && x.Version == 1, ct);
        if (existing is not null)
        {
            typeSpecCache[itemType] = existing;
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var created = new CogitaKnowledgeTypeSpec
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            TypeKey = typeKey,
            Version = 1,
            DisplayName = itemType == "connection" ? "Legacy Connection" : "Legacy Knowledge Item",
            SpecJson = "{\"source\":\"legacy-review-outcomes\"}",
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.CogitaKnowledgeTypeSpecs.Add(created);
        typeSpecCache[itemType] = created;
        return created;
    }

    private static async Task<CogitaNotion> EnsureLegacyNotionAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        Guid roleId,
        CogitaKnowledgeTypeSpec typeSpec,
        string itemType,
        Guid legacyItemId,
        IDictionary<string, CogitaNotion> itemCache,
        CancellationToken ct)
    {
        var legacyItemKey = $"{itemType}:{legacyItemId:D}";
        if (itemCache.TryGetValue(legacyItemKey, out var cached))
        {
            return cached;
        }

        var existing = await dbContext.CogitaNotions
            .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.SearchText == legacyItemKey, ct);
        if (existing is not null)
        {
            itemCache[legacyItemKey] = existing;
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var created = new CogitaNotion
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            RoleId = roleId,
            TypeSpecId = typeSpec.Id,
            TypeKey = typeSpec.TypeKey,
            Title = legacyItemKey,
            SearchText = legacyItemKey,
            PayloadJson = JsonSerializer.Serialize(new
            {
                source = "legacy-review-outcomes",
                itemType,
                itemId = legacyItemId
            }, JsonOptions),
            IsExcludedFromKnowness = false,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.CogitaNotions.Add(created);
        itemCache[legacyItemKey] = created;
        return created;
    }

    private static async Task<CogitaCheckcardDefinitionCore> EnsureLegacyCheckcardDefinitionAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        Guid sourceItemId,
        string itemType,
        string cardKey,
        string? checkType,
        string? direction,
        IDictionary<string, CogitaCheckcardDefinitionCore> checkcardCache,
        CancellationToken ct)
    {
        if (checkcardCache.TryGetValue(cardKey, out var cached))
        {
            return cached;
        }

        var existing = await dbContext.CogitaCheckcardDefinitionsCore
            .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.CardKey == cardKey, ct);
        if (existing is not null)
        {
            checkcardCache[cardKey] = existing;
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var created = new CogitaCheckcardDefinitionCore
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            SourceItemId = sourceItemId,
            CardKey = cardKey,
            CardType = string.IsNullOrWhiteSpace(checkType) ? itemType : checkType.Trim().ToLowerInvariant(),
            Direction = 0,
            PromptJson = JsonSerializer.Serialize(new
            {
                source = "legacy-review-outcomes",
                itemType,
                checkType = string.IsNullOrWhiteSpace(checkType) ? null : checkType.Trim(),
                direction = string.IsNullOrWhiteSpace(direction) ? null : direction.Trim()
            }, JsonOptions),
            RevealJson = "{}",
            IsActive = true,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.CogitaCheckcardDefinitionsCore.Add(created);
        checkcardCache[cardKey] = created;
        return created;
    }

    private static string NormalizeJson(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return "{}";
        }

        try
        {
            using var doc = JsonDocument.Parse(raw);
            return doc.RootElement.GetRawText();
        }
        catch
        {
            return "{}";
        }
    }

    private static async Task<Dictionary<string, double>> LoadKnownessMapForSelectionAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        CogitaRevisionRun run,
        Guid participantId,
        CancellationToken ct)
    {
        var runScope = CogitaCorePolicies.NormalizeRunScope(run.RunScope);
        if (runScope == "group_sync")
        {
            var roleIds = await dbContext.CogitaRunParticipantsCore.AsNoTracking()
                .Where(x => x.RunId == run.Id && x.PersonRoleId.HasValue)
                .Select(x => x.PersonRoleId!.Value)
                .Distinct()
                .ToListAsync(ct);
            if (roleIds.Count == 0)
            {
                return new Dictionary<string, double>(StringComparer.Ordinal);
            }

            var snapshots = await dbContext.CogitaKnownessSnapshots.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && roleIds.Contains(x.PersonRoleId))
                .OrderByDescending(x => x.SnapshotUtc)
                .ToListAsync(ct);

            var latestByRoleAndCard = new Dictionary<(Guid RoleId, string CardKey), double>();
            foreach (var snapshot in snapshots)
            {
                var key = (snapshot.PersonRoleId, snapshot.CardKey);
                if (!latestByRoleAndCard.ContainsKey(key))
                {
                    latestByRoleAndCard[key] = (double)snapshot.KnownessPct;
                }
            }

            var cardScores = new Dictionary<string, double>(StringComparer.Ordinal);
            var roleCount = Math.Max(1, roleIds.Count);
            foreach (var pair in latestByRoleAndCard)
            {
                if (!cardScores.TryAdd(pair.Key.CardKey, pair.Value / roleCount))
                {
                    cardScores[pair.Key.CardKey] += pair.Value / roleCount;
                }
            }
            return cardScores;
        }

        var personRoleId = await dbContext.CogitaRunParticipantsCore.AsNoTracking()
            .Where(x => x.RunId == run.Id && x.Id == participantId)
            .Select(x => x.PersonRoleId)
            .FirstOrDefaultAsync(ct);
        if (!personRoleId.HasValue || personRoleId.Value == Guid.Empty)
        {
            return new Dictionary<string, double>(StringComparer.Ordinal);
        }

        var rows = await dbContext.CogitaKnownessSnapshots.AsNoTracking()
            .Where(x => x.LibraryId == libraryId && x.PersonRoleId == personRoleId.Value)
            .OrderByDescending(x => x.SnapshotUtc)
            .ToListAsync(ct);
        var map = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            if (!map.ContainsKey(row.CardKey))
            {
                map[row.CardKey] = (double)row.KnownessPct;
            }
        }
        return map;
    }

    private static async Task<(CoreKnownessSnapshotResponse? Snapshot, List<CoreKnownessPropagationResponse> Propagation)> UpdateKnownessForAttemptAsync(
        RecreatioDbContext dbContext,
        Guid libraryId,
        Guid runId,
        CogitaRunParticipantCore participant,
        string cardKey,
        string outcomeClass,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var propagation = new List<CoreKnownessPropagationResponse>();
        if (!participant.PersonRoleId.HasValue || participant.PersonRoleId == Guid.Empty)
        {
            return (null, propagation);
        }

        var personRoleId = participant.PersonRoleId.Value;

        var previousSnapshot = await dbContext.CogitaKnownessSnapshots.AsNoTracking()
            .Where(x => x.LibraryId == libraryId && x.PersonRoleId == personRoleId && x.CardKey == cardKey)
            .OrderByDescending(x => x.SnapshotUtc)
            .FirstOrDefaultAsync(ct);

        var history = await dbContext.CogitaRunAttempts.AsNoTracking()
            .Where(x => x.ParticipantId == participant.Id && x.CardKey == cardKey)
            .OrderByDescending(x => x.SubmittedUtc)
            .Select(x => new KnownessOutcomeEntry(x.OutcomeClass, x.SubmittedUtc))
            .Take(96)
            .ToListAsync(ct);

        var summary = CogitaKnownessCore.ComputeOutcomePolicySummary(history, now);
        var correctCount = previousSnapshot?.CorrectCount ?? 0;
        var wrongCount = previousSnapshot?.WrongCount ?? 0;
        var unansweredCount = previousSnapshot?.UnansweredCount ?? 0;
        switch (CogitaKnownessCore.NormalizeOutcomeClass(outcomeClass))
        {
            case "correct":
                correctCount++;
                break;
            case "blank_timeout":
                unansweredCount++;
                break;
            default:
                wrongCount++;
                break;
        }

        var snapshot = new CogitaKnownessSnapshot
        {
            Id = Guid.NewGuid(),
            LibraryId = libraryId,
            PersonRoleId = personRoleId,
            CardKey = cardKey,
            SnapshotUtc = now,
            KnownessPct = (decimal)summary.Score,
            CorrectCount = correctCount,
            WrongCount = wrongCount,
            UnansweredCount = unansweredCount,
            LastSeenUtc = now,
            SourceRunId = runId,
            SourceParticipantId = participant.Id,
            CreatedUtc = now
        };
        dbContext.CogitaKnownessSnapshots.Add(snapshot);

        var rootCard = await dbContext.CogitaCheckcardDefinitionsCore.AsNoTracking()
            .FirstOrDefaultAsync(x => x.LibraryId == libraryId && x.CardKey == cardKey, ct);
        if (rootCard is null)
        {
            return (
                new CoreKnownessSnapshotResponse(
                    snapshot.Id,
                    snapshot.LibraryId,
                    snapshot.PersonRoleId,
                    snapshot.CardKey,
                    snapshot.KnownessPct,
                    snapshot.CorrectCount,
                    snapshot.WrongCount,
                    snapshot.UnansweredCount,
                    snapshot.SnapshotUtc,
                    snapshot.SourceRunId,
                    snapshot.SourceParticipantId),
                propagation);
        }

        var queue = new Queue<Guid>();
        queue.Enqueue(rootCard.Id);
        var visited = new HashSet<Guid>();

        while (queue.Count > 0)
        {
            var childCardId = queue.Dequeue();
            if (!visited.Add(childCardId))
            {
                continue;
            }

            var parentLinks = await dbContext.CogitaDependencyEdgesCore.AsNoTracking()
                .Where(x => x.LibraryId == libraryId && x.ChildCardId == childCardId)
                .ToListAsync(ct);
            if (parentLinks.Count == 0)
            {
                continue;
            }

            foreach (var parentLink in parentLinks)
            {
                var parentCard = await dbContext.CogitaCheckcardDefinitionsCore.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == parentLink.ParentCardId, ct);
                if (parentCard is null)
                {
                    continue;
                }

                var allParentEdges = await dbContext.CogitaDependencyEdgesCore.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.ParentCardId == parentCard.Id)
                    .ToListAsync(ct);
                if (allParentEdges.Count == 0)
                {
                    continue;
                }

                var childCardIds = allParentEdges.Select(x => x.ChildCardId).Distinct().ToList();
                var childCards = await dbContext.CogitaCheckcardDefinitionsCore.AsNoTracking()
                    .Where(x => childCardIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.CardKey })
                    .ToListAsync(ct);
                var childCardKeyById = childCards.ToDictionary(x => x.Id, x => x.CardKey);

                var childCardKeys = childCards.Select(x => x.CardKey).Distinct().ToList();
                var latestChildSnapshots = await dbContext.CogitaKnownessSnapshots.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.PersonRoleId == personRoleId && childCardKeys.Contains(x.CardKey))
                    .OrderByDescending(x => x.SnapshotUtc)
                    .ToListAsync(ct);
                var latestKnownessByCardKey = new Dictionary<string, double>(StringComparer.Ordinal);
                foreach (var row in latestChildSnapshots)
                {
                    if (!latestKnownessByCardKey.ContainsKey(row.CardKey))
                    {
                        latestKnownessByCardKey[row.CardKey] = (double)row.KnownessPct;
                    }
                }

                var parentDirectKnowness = await LoadDirectKnownessAsync(dbContext, participant.Id, parentCard.CardKey, now, ct);
                var contribution = 0d;
                foreach (var edge in allParentEdges)
                {
                    if (!childCardKeyById.TryGetValue(edge.ChildCardId, out var childCardKey))
                    {
                        continue;
                    }

                    if (!latestKnownessByCardKey.TryGetValue(childCardKey, out var childKnowness))
                    {
                        childKnowness = 0d;
                    }
                    contribution += childKnowness * ((double)edge.ParentKnownessWeightPct / 100d);
                }

                var parentKnowness = Math.Round(Math.Clamp(parentDirectKnowness + contribution, 0d, 100d), 2);
                var parentPreviousSnapshot = await dbContext.CogitaKnownessSnapshots.AsNoTracking()
                    .Where(x => x.LibraryId == libraryId && x.PersonRoleId == personRoleId && x.CardKey == parentCard.CardKey)
                    .OrderByDescending(x => x.SnapshotUtc)
                    .FirstOrDefaultAsync(ct);

                var parentSnapshot = new CogitaKnownessSnapshot
                {
                    Id = Guid.NewGuid(),
                    LibraryId = libraryId,
                    PersonRoleId = personRoleId,
                    CardKey = parentCard.CardKey,
                    SnapshotUtc = now,
                    KnownessPct = (decimal)parentKnowness,
                    CorrectCount = parentPreviousSnapshot?.CorrectCount ?? 0,
                    WrongCount = parentPreviousSnapshot?.WrongCount ?? 0,
                    UnansweredCount = parentPreviousSnapshot?.UnansweredCount ?? 0,
                    LastSeenUtc = now,
                    SourceRunId = runId,
                    SourceParticipantId = participant.Id,
                    CreatedUtc = now
                };
                dbContext.CogitaKnownessSnapshots.Add(parentSnapshot);

                propagation.Add(new CoreKnownessPropagationResponse(
                    parentCard.CardKey,
                    Math.Round(parentDirectKnowness, 2),
                    Math.Round(contribution, 2),
                    parentKnowness));

                queue.Enqueue(parentCard.Id);
            }
        }

        return (
            new CoreKnownessSnapshotResponse(
                snapshot.Id,
                snapshot.LibraryId,
                snapshot.PersonRoleId,
                snapshot.CardKey,
                snapshot.KnownessPct,
                snapshot.CorrectCount,
                snapshot.WrongCount,
                snapshot.UnansweredCount,
                snapshot.SnapshotUtc,
                snapshot.SourceRunId,
                snapshot.SourceParticipantId),
            propagation);
    }

    private static async Task<double> LoadDirectKnownessAsync(
        RecreatioDbContext dbContext,
        Guid participantId,
        string cardKey,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var history = await dbContext.CogitaRunAttempts.AsNoTracking()
            .Where(x => x.ParticipantId == participantId && x.CardKey == cardKey)
            .OrderByDescending(x => x.SubmittedUtc)
            .Select(x => new KnownessOutcomeEntry(x.OutcomeClass, x.SubmittedUtc))
            .Take(96)
            .ToListAsync(ct);
        var summary = CogitaKnownessCore.ComputeOutcomePolicySummary(history, now);
        return summary.Score;
    }

    private static async Task<int> CountCurrentCorrectStreakAsync(
        RecreatioDbContext dbContext,
        Guid runId,
        Guid participantId,
        CancellationToken ct)
    {
        var history = await dbContext.CogitaRunAttempts.AsNoTracking()
            .Where(x => x.RunId == runId && x.ParticipantId == participantId)
            .OrderByDescending(x => x.SubmittedUtc)
            .Select(x => x.OutcomeClass)
            .Take(64)
            .ToListAsync(ct);

        var streak = 0;
        foreach (var outcome in history)
        {
            if (CogitaKnownessCore.NormalizeOutcomeClass(outcome) != "correct")
            {
                break;
            }
            streak++;
        }

        return streak;
    }

    private static List<CoreScoreFactorResponse> BuildScoreFactors(string outcomeClass, int? responseDurationMs, int streakCount)
    {
        var factors = new List<CoreScoreFactorResponse>();
        switch (CogitaKnownessCore.NormalizeOutcomeClass(outcomeClass))
        {
            case "correct":
                factors.Add(new CoreScoreFactorResponse("base", 100));
                break;
            case "blank_timeout":
                factors.Add(new CoreScoreFactorResponse("blank_timeout", -45));
                break;
            default:
                factors.Add(new CoreScoreFactorResponse("wrong", -70));
                break;
        }

        if (CogitaKnownessCore.NormalizeOutcomeClass(outcomeClass) == "correct" && responseDurationMs.HasValue)
        {
            var speedBonus = Math.Max(0, Math.Min(25, (15000 - Math.Max(0, responseDurationMs.Value)) / 600));
            if (speedBonus > 0)
            {
                factors.Add(new CoreScoreFactorResponse("speed", speedBonus));
            }

            var streakBonus = CogitaRunScoringCore.ComputeStreakContribution("limited", 30, streakCount, 8);
            if (streakBonus > 0)
            {
                factors.Add(new CoreScoreFactorResponse("streak", streakBonus));
            }
        }

        return factors.Where(x => x.Points != 0).ToList();
    }

    private static async Task<CoreRevealResponse> BuildRevealResponseAsync(
        RecreatioDbContext dbContext,
        Guid runId,
        Guid participantId,
        int roundIndex,
        string cardKey,
        IReadOnlyList<CoreScoreFactorResponse> scoreFactors,
        int totalPoints,
        CancellationToken ct)
    {
        var allAttempts = await dbContext.CogitaRunAttempts.AsNoTracking()
            .Where(x => x.RunId == runId && x.CardKey == cardKey)
            .OrderByDescending(x => x.SubmittedUtc)
            .ToListAsync(ct);

        var latestParticipantAttempt = allAttempts
            .Where(x => x.ParticipantId == participantId)
            .OrderByDescending(x => x.SubmittedUtc)
            .FirstOrDefault();

        var participantHistory = allAttempts
            .Where(x => x.ParticipantId == participantId)
            .Take(10)
            .Select(x => new CorePastAnswerResponse(
                x.RoundIndex,
                x.SubmittedUtc,
                CogitaKnownessCore.NormalizeOutcomeClass(x.OutcomeClass),
                x.AnswerCipher))
            .ToList();

        var correctCount = allAttempts.Count(x => CogitaKnownessCore.NormalizeOutcomeClass(x.OutcomeClass) == "correct");
        var wrongCount = allAttempts.Count(x => CogitaKnownessCore.NormalizeOutcomeClass(x.OutcomeClass) == "wrong");
        var blankCount = allAttempts.Count(x => CogitaKnownessCore.NormalizeOutcomeClass(x.OutcomeClass) == "blank_timeout");
        var total = Math.Max(1, allAttempts.Count);

        var cardDefinition = await dbContext.CogitaCheckcardDefinitionsCore.AsNoTracking()
            .FirstOrDefaultAsync(x => x.CardKey == cardKey, ct);

        return new CoreRevealResponse(
            runId,
            participantId,
            roundIndex,
            cardKey,
            ExtractCorrectAnswer(cardDefinition?.RevealJson),
            latestParticipantAttempt?.AnswerCipher,
            participantHistory,
            new CoreOutcomeDistributionResponse(
                correctCount,
                wrongCount,
                blankCount,
                Math.Round(correctCount / (double)total * 100d, 2),
                Math.Round(wrongCount / (double)total * 100d, 2),
                Math.Round(blankCount / (double)total * 100d, 2)),
            scoreFactors.Where(x => x.Points != 0).ToList(),
            totalPoints);
    }

    private static string? ExtractCorrectAnswer(string? revealJson)
    {
        if (string.IsNullOrWhiteSpace(revealJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(revealJson);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.String)
            {
                return root.GetString();
            }
            if (root.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            var preferredKeys = new[] { "correctAnswer", "answer", "expected", "solution" };
            foreach (var key in preferredKeys)
            {
                if (root.TryGetProperty(key, out var value))
                {
                    return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
                }
            }

            return root.ToString();
        }
        catch
        {
            return null;
        }
    }

    private static CoreCharComparisonResponse? BuildCharComparison(string? participantAnswer, string? correctAnswer)
    {
        if (string.IsNullOrWhiteSpace(participantAnswer) || string.IsNullOrWhiteSpace(correctAnswer))
        {
            return null;
        }

        var expected = correctAnswer.Trim();
        var actual = participantAnswer.Trim();
        var comparedLength = Math.Max(expected.Length, actual.Length);
        if (comparedLength == 0)
        {
            return new CoreCharComparisonResponse(0, 0, 100d, Array.Empty<CoreCharMismatchResponse>());
        }

        var mismatchCount = 0;
        var mismatches = new List<CoreCharMismatchResponse>();
        for (var index = 0; index < comparedLength; index++)
        {
            var expectedChar = index < expected.Length ? expected[index].ToString() : null;
            var actualChar = index < actual.Length ? actual[index].ToString() : null;
            if (string.Equals(expectedChar, actualChar, StringComparison.Ordinal))
            {
                continue;
            }

            mismatchCount++;
            if (mismatches.Count < 64)
            {
                mismatches.Add(new CoreCharMismatchResponse(index, expectedChar, actualChar));
            }
        }

        var similarityPct = Math.Round(Math.Max(0d, Math.Min(100d, ((comparedLength - mismatchCount) / (double)comparedLength) * 100d)), 2);
        return new CoreCharComparisonResponse(comparedLength, mismatchCount, similarityPct, mismatches);
    }

    private static ParsedAttemptEventPayload SafeParseEventPayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return ParsedAttemptEventPayload.Empty;
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return ParsedAttemptEventPayload.Empty;
            }

            string outcomeClass = "wrong";
            var totalPoints = 0;
            var responseDurationMs = 0;
            string? cardKey = null;

            if (root.TryGetProperty("outcomeClass", out var outcomeProp) && outcomeProp.ValueKind == JsonValueKind.String)
            {
                outcomeClass = CogitaKnownessCore.NormalizeOutcomeClass(outcomeProp.GetString());
            }
            if (root.TryGetProperty("totalPoints", out var pointsProp) && pointsProp.TryGetInt32(out var parsedPoints))
            {
                totalPoints = parsedPoints;
            }
            if (root.TryGetProperty("responseDurationMs", out var durationProp) && durationProp.TryGetInt32(out var parsedDuration))
            {
                responseDurationMs = Math.Max(0, parsedDuration);
            }
            if (root.TryGetProperty("cardKey", out var cardProp) && cardProp.ValueKind == JsonValueKind.String)
            {
                cardKey = cardProp.GetString();
            }

            return new ParsedAttemptEventPayload(outcomeClass, totalPoints, responseDurationMs, cardKey);
        }
        catch
        {
            return ParsedAttemptEventPayload.Empty;
        }
    }

    private static ParsedStackPayload SafeParseStackPayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return ParsedStackPayload.Empty;
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return ParsedStackPayload.Empty;
            }

            var cycle = 0;
            if (root.TryGetProperty("cycle", out var cycleProp) && cycleProp.TryGetInt32(out var parsedCycle))
            {
                cycle = Math.Max(0, parsedCycle);
            }

            int? blockedCount = null;
            if (root.TryGetProperty("blockedCount", out var blockedProp) && blockedProp.TryGetInt32(out var parsedBlocked))
            {
                blockedCount = Math.Max(0, parsedBlocked);
            }

            var roundIndexes = new List<int>();
            if (root.TryGetProperty("roundIndexes", out var roundsProp) && roundsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var round in roundsProp.EnumerateArray())
                {
                    if (round.TryGetInt32(out var parsedRound) && parsedRound >= 0)
                    {
                        roundIndexes.Add(parsedRound);
                    }
                }
            }

            return new ParsedStackPayload(cycle, roundIndexes, blockedCount);
        }
        catch
        {
            return ParsedStackPayload.Empty;
        }
    }

    private sealed class MutableParticipantStats
    {
        public Guid ParticipantId { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public int AttemptCount { get; set; }
        public int CorrectCount { get; set; }
        public int WrongCount { get; set; }
        public int BlankCount { get; set; }
        public int TotalPoints { get; set; }
        public long TotalDurationMs { get; set; }
        public int DurationCount { get; set; }
    }

    private readonly record struct ParsedAttemptEventPayload(
        string OutcomeClass,
        int TotalPoints,
        int ResponseDurationMs,
        string? CardKey)
    {
        public static readonly ParsedAttemptEventPayload Empty = new("wrong", 0, 0, null);
    }

    private readonly record struct ParsedStackPayload(
        int Cycle,
        IReadOnlyList<int> RoundIndexes,
        int? BlockedCount)
    {
        public static readonly ParsedStackPayload Empty = new(0, Array.Empty<int>(), null);
    }

    private readonly record struct CoreCardRow(Guid Id, string CardKey);

    public sealed record CreateCoreRunRequest(
        [property: JsonPropertyName("revisionPatternId")] Guid? RevisionPatternId,
        [property: JsonPropertyName("runScope")] string RunScope,
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("status")] string? Status,
        [property: JsonPropertyName("settingsJson")] string? SettingsJson,
        [property: JsonPropertyName("promptBundleJson")] string? PromptBundleJson);

    public sealed record JoinCoreRunRequest(
        [property: JsonPropertyName("personRoleId")] Guid? PersonRoleId,
        [property: JsonPropertyName("displayName")] string? DisplayName,
        [property: JsonPropertyName("isHost")] bool IsHost,
        [property: JsonPropertyName("recoveryToken")] string? RecoveryToken);

    public sealed record SetCoreRunStatusRequest(
        [property: JsonPropertyName("status")] string Status,
        [property: JsonPropertyName("reason")] string? Reason);

    public sealed record CoreNextCardRequest(
        [property: JsonPropertyName("participantId")] Guid ParticipantId,
        [property: JsonPropertyName("participantSeed")] Guid ParticipantSeed);

    public sealed record CoreRunAttemptRequest(
        [property: JsonPropertyName("participantId")] Guid ParticipantId,
        [property: JsonPropertyName("roundIndex")] int RoundIndex,
        [property: JsonPropertyName("cardKey")] string CardKey,
        [property: JsonPropertyName("answer")] string? Answer,
        [property: JsonPropertyName("outcomeClass")] string OutcomeClass,
        [property: JsonPropertyName("responseDurationMs")] int? ResponseDurationMs,
        [property: JsonPropertyName("promptShownUtc")] DateTimeOffset? PromptShownUtc,
        [property: JsonPropertyName("revealedUtc")] DateTimeOffset? RevealedUtc);

    public sealed record CoreRunEventAppendRequest(
        [property: JsonPropertyName("participantId")] Guid? ParticipantId,
        [property: JsonPropertyName("eventType")] string EventType,
        [property: JsonPropertyName("roundIndex")] int? RoundIndex,
        [property: JsonPropertyName("payloadJson")] string? PayloadJson);

    public sealed record CreateCoreCreationArtifactRequest(
        [property: JsonPropertyName("artifactType")] string ArtifactType,
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("contentJson")] string? ContentJson,
        [property: JsonPropertyName("sourceItemId")] Guid? SourceItemId,
        [property: JsonPropertyName("sourceCardKey")] string? SourceCardKey);

    public sealed record UpsertCoreReferenceCryptoFieldRequest(
        [property: JsonPropertyName("ownerEntity")] string OwnerEntity,
        [property: JsonPropertyName("ownerId")] Guid OwnerId,
        [property: JsonPropertyName("fieldKey")] string FieldKey,
        [property: JsonPropertyName("policyVersion")] string? PolicyVersion,
        [property: JsonPropertyName("plainValue")] string? PlainValue,
        [property: JsonPropertyName("valueCipher")] string? ValueCipher,
        [property: JsonPropertyName("signatureBase64")] string? SignatureBase64,
        [property: JsonPropertyName("signer")] string? Signer,
        [property: JsonPropertyName("signatureVersion")] string? SignatureVersion);

    public sealed record LegacyReviewOutcomeSyncRequest(
        [property: JsonPropertyName("outcomes")] IReadOnlyList<LegacyReviewOutcomeSyncItem> Outcomes);

    public sealed record LegacyReviewOutcomeSyncItem(
        [property: JsonPropertyName("itemType")] string ItemType,
        [property: JsonPropertyName("itemId")] Guid ItemId,
        [property: JsonPropertyName("checkType")] string? CheckType,
        [property: JsonPropertyName("direction")] string? Direction,
        [property: JsonPropertyName("revisionType")] string? RevisionType,
        [property: JsonPropertyName("evalType")] string? EvalType,
        [property: JsonPropertyName("correct")] bool Correct,
        [property: JsonPropertyName("clientId")] string? ClientId,
        [property: JsonPropertyName("clientSequence")] int ClientSequence,
        [property: JsonPropertyName("durationMs")] int? DurationMs,
        [property: JsonPropertyName("personRoleId")] Guid? PersonRoleId);

    public sealed record LegacyReviewOutcomeSyncResponse(
        [property: JsonPropertyName("synced")] int Synced,
        [property: JsonPropertyName("skipped")] int Skipped);

    public sealed record CoreRunSummaryResponse(
        Guid RunId,
        Guid LibraryId,
        Guid RevisionPatternId,
        string RunScope,
        string? Title,
        string Status,
        DateTimeOffset CreatedUtc,
        DateTimeOffset UpdatedUtc,
        int ParticipantCount,
        int TotalCards);

    public sealed record CoreRunStatusResponse(
        Guid RunId,
        string Status,
        DateTimeOffset? StartedUtc,
        DateTimeOffset? FinishedUtc,
        DateTimeOffset UpdatedUtc);

    public sealed record CoreRunParticipantResponse(
        Guid ParticipantId,
        Guid RunId,
        Guid? PersonRoleId,
        string DisplayName,
        bool IsHost,
        bool IsConnected,
        DateTimeOffset JoinedUtc,
        DateTimeOffset UpdatedUtc,
        string? RecoveryToken,
        DateTimeOffset? RecoveryExpiresUtc);

    public sealed record CoreRunParticipantProgressResponse(
        int AttemptCount,
        int CorrectCount,
        int WrongCount,
        int BlankTimeoutCount,
        double CompletionPct);

    public sealed record CoreRunStateResponse(
        CoreRunSummaryResponse Run,
        IReadOnlyList<CoreRunParticipantResponse> Participants,
        CoreRunParticipantProgressResponse ParticipantProgress,
        int TotalAttempts,
        int TotalEvents);

    public sealed record CoreNextCardResponse(
        string? CardKey,
        int? RoundIndex,
        string Reason,
        IReadOnlyList<string> ReasonTrace,
        int TotalCards,
        int BlockedCards);

    public sealed record CoreScoreFactorResponse(
        string Factor,
        int Points);

    public sealed record CorePastAnswerResponse(
        int RoundIndex,
        DateTimeOffset SubmittedUtc,
        string OutcomeClass,
        string? Answer);

    public sealed record CoreOutcomeDistributionResponse(
        int CorrectCount,
        int WrongCount,
        int BlankTimeoutCount,
        double CorrectPct,
        double WrongPct,
        double BlankTimeoutPct);

    public sealed record CoreRevealResponse(
        Guid RunId,
        Guid ParticipantId,
        int RoundIndex,
        string CardKey,
        string? CorrectAnswer,
        string? ParticipantAnswer,
        IReadOnlyList<CorePastAnswerResponse> PastAnswers,
        CoreOutcomeDistributionResponse OutcomeDistribution,
        IReadOnlyList<CoreScoreFactorResponse> ScoreFactors,
        int TotalPoints);

    public sealed record CoreKnownessSnapshotResponse(
        Guid SnapshotId,
        Guid LibraryId,
        Guid PersonRoleId,
        string CardKey,
        decimal KnownessPct,
        int CorrectCount,
        int WrongCount,
        int UnansweredCount,
        DateTimeOffset SnapshotUtc,
        Guid? SourceRunId,
        Guid? SourceParticipantId);

    public sealed record CoreKnownessPropagationResponse(
        string ParentCardKey,
        double ParentDirectKnowness,
        double ChildContribution,
        double ParentKnowness);

    public sealed record CoreCharMismatchResponse(
        int Index,
        string? Expected,
        string? Actual);

    public sealed record CoreCharComparisonResponse(
        int ComparedLength,
        int MismatchCount,
        double SimilarityPct,
        IReadOnlyList<CoreCharMismatchResponse> MismatchesPreview);

    public sealed record CoreRunAttemptResponse(
        Guid AttemptId,
        Guid RunId,
        Guid ParticipantId,
        int RoundIndex,
        string CardKey,
        string OutcomeClass,
        DateTimeOffset SubmittedUtc,
        DateTimeOffset? RevealedUtc,
        int? ResponseDurationMs,
        int TotalPoints,
        IReadOnlyList<CoreScoreFactorResponse> ScoreFactors,
        CoreRevealResponse Reveal,
        CoreCharComparisonResponse? CharComparison,
        CoreKnownessSnapshotResponse? KnownessSnapshot,
        IReadOnlyList<CoreKnownessPropagationResponse> KnownessPropagation);

    public sealed record CoreRunEventResponse(
        Guid EventId,
        Guid RunId,
        Guid? ParticipantId,
        string EventType,
        int? RoundIndex,
        string? PayloadJson,
        DateTimeOffset CreatedUtc);

    public sealed record CoreRunParticipantStatisticsResponse(
        Guid ParticipantId,
        string DisplayName,
        int AttemptCount,
        int CorrectCount,
        int WrongCount,
        int BlankTimeoutCount,
        double KnownessScore,
        int TotalPoints,
        double AverageDurationMs);

    public sealed record CoreRunTimelineItemResponse(
        int Index,
        DateTimeOffset CreatedUtc,
        Guid ParticipantId,
        string ParticipantLabel,
        int? RoundIndex,
        string? CardKey,
        string OutcomeClass,
        int Points,
        int DurationMs);

    public sealed record CoreRunStatisticsResponse(
        Guid RunId,
        string RunScope,
        string Status,
        int TotalAttempts,
        int TotalCorrect,
        int TotalWrong,
        int TotalBlankTimeout,
        double KnownessScore,
        int TotalPoints,
        IReadOnlyList<CoreRunParticipantStatisticsResponse> Participants,
        IReadOnlyList<CoreRunTimelineItemResponse> Timeline);

    public sealed record CoreCreationArtifactResponse(
        Guid ArtifactId,
        Guid LibraryId,
        Guid ProjectId,
        string ArtifactType,
        string Name,
        string ContentJson,
        Guid? SourceItemId,
        string? SourceCardKey,
        DateTimeOffset CreatedUtc,
        DateTimeOffset UpdatedUtc);

    public sealed record CoreReferenceCryptoFieldResponse(
        Guid FieldId,
        Guid LibraryId,
        string OwnerEntity,
        Guid OwnerId,
        string FieldKey,
        string PolicyVersion,
        string ValueCipher,
        string DeterministicHashBase64,
        string? SignatureBase64,
        string? Signer,
        string? SignatureVersion,
        DateTimeOffset CreatedUtc,
        DateTimeOffset UpdatedUtc);

    public sealed record CoreReferenceCryptoFieldSearchResponse(
        Guid FieldId,
        string OwnerEntity,
        Guid OwnerId,
        string FieldKey,
        string PolicyVersion,
        string? Signer,
        string? SignatureVersion,
        DateTimeOffset UpdatedUtc);
}
