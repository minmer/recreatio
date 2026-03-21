using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Cogita;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cogita;
using Recreatio.Api.Services.Cogita;

namespace Recreatio.Api.Endpoints.Cogita;

public static class CogitaGameEndpoints
{
    public static void MapCogitaGameEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/cogita").RequireAuthorization();
        MapAuthorized(auth);

        var pub = app.MapGroup("/cogita/public/game").AllowAnonymous();
        MapPublic(pub);

        app.MapHub<CogitaGameHub>("/hubs/cogita-game");
    }

    private static void MapAuthorized(RouteGroupBuilder group)
    {
        group.MapGet("/libraries/{libraryId:guid}/games", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            string? q,
            int? limit,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var normalizedLimit = Math.Clamp(limit ?? 200, 1, 1000);
            var normalizedQuery = (q ?? string.Empty).Trim();

            var query = dbContext.CogitaGames.AsNoTracking().Where(x => x.LibraryId == libraryId && !x.IsArchived);
            if (normalizedQuery.Length > 0)
            {
                query = query.Where(x => x.Name.Contains(normalizedQuery));
            }

            var games = await query.OrderByDescending(x => x.UpdatedUtc)
                .Take(normalizedLimit)
                .Select(x => new CogitaGameSummaryResponse(
                    x.Id,
                    x.LibraryId,
                    x.Name,
                    x.Mode,
                    x.StoryboardProjectId,
                    x.IsArchived,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);

            return Results.Ok(games);
        });

        group.MapPost("/libraries/{libraryId:guid}/games", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            CogitaGameCreateRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var roleId = await dbContext.CogitaLibraries.AsNoTracking()
                .Where(x => x.Id == libraryId)
                .Select(x => x.RoleId)
                .FirstOrDefaultAsync(ct);
            if (roleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "Library role is missing." });
            }

            var name = (request.Name ?? string.Empty).Trim();
            if (name.Length == 0)
            {
                return Results.BadRequest(new { error = "Name is required." });
            }

            if (name.Length > 256)
            {
                name = name[..256];
            }

            var mode = NormalizeGameMode(request.Mode);
            var now = DateTimeOffset.UtcNow;

            var game = new CogitaGame
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                RoleId = roleId,
                Name = name,
                StoryboardProjectId = request.StoryboardProjectId,
                Mode = mode,
                SettingsJson = request.Settings.HasValue ? request.Settings.Value.GetRawText() : "{}",
                CreatedUtc = now,
                UpdatedUtc = now,
                IsArchived = false
            };

            dbContext.CogitaGames.Add(game);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaGameSummaryResponse(
                game.Id,
                game.LibraryId,
                game.Name,
                game.Mode,
                game.StoryboardProjectId,
                game.IsArchived,
                game.CreatedUtc,
                game.UpdatedUtc));
        });

        group.MapGet("/libraries/{libraryId:guid}/games/{gameId:guid}", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid gameId,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var game = await dbContext.CogitaGames.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == gameId && x.LibraryId == libraryId, ct);
            if (game is null)
            {
                return Results.NotFound();
            }

            JsonElement? settings = ParseOptionalJson(game.SettingsJson);
            return Results.Ok(new
            {
                gameId = game.Id,
                libraryId = game.LibraryId,
                name = game.Name,
                mode = game.Mode,
                storyboardProjectId = game.StoryboardProjectId,
                isArchived = game.IsArchived,
                settings,
                createdUtc = game.CreatedUtc,
                updatedUtc = game.UpdatedUtc
            });
        });

        group.MapPut("/libraries/{libraryId:guid}/games/{gameId:guid}", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid gameId,
            CogitaGameUpdateRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var game = await dbContext.CogitaGames
                .FirstOrDefaultAsync(x => x.Id == gameId && x.LibraryId == libraryId, ct);
            if (game is null)
            {
                return Results.NotFound();
            }

            if (request.Name is not null)
            {
                var normalized = request.Name.Trim();
                if (normalized.Length == 0)
                {
                    return Results.BadRequest(new { error = "Name cannot be empty." });
                }

                game.Name = normalized.Length > 256 ? normalized[..256] : normalized;
            }

            if (request.Mode is not null)
            {
                game.Mode = NormalizeGameMode(request.Mode);
            }

            if (request.StoryboardProjectId.HasValue)
            {
                game.StoryboardProjectId = request.StoryboardProjectId;
            }

            if (request.Settings.HasValue)
            {
                game.SettingsJson = request.Settings.Value.GetRawText();
            }

            if (request.IsArchived.HasValue)
            {
                game.IsArchived = request.IsArchived.Value;
            }

            game.UpdatedUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaGameSummaryResponse(
                game.Id,
                game.LibraryId,
                game.Name,
                game.Mode,
                game.StoryboardProjectId,
                game.IsArchived,
                game.CreatedUtc,
                game.UpdatedUtc));
        });

        group.MapGet("/libraries/{libraryId:guid}/games/{gameId:guid}/values", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid gameId,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var exists = await dbContext.CogitaGames.AsNoTracking().AnyAsync(x => x.Id == gameId && x.LibraryId == libraryId, ct);
            if (!exists)
            {
                return Results.NotFound();
            }

            var values = await dbContext.CogitaGameValues.AsNoTracking()
                .Where(x => x.GameId == gameId)
                .OrderBy(x => x.Name)
                .Select(x => new CogitaGameValueResponse(
                    x.Id,
                    x.ValueKey,
                    x.Name,
                    x.ScopeType,
                    x.Visibility,
                    x.DataType,
                    ParseOptionalJson(x.DefaultValueJson),
                    ParseOptionalJson(x.ConstraintsJson),
                    x.IsScore,
                    x.UpdatedUtc))
                .ToListAsync(ct);

            return Results.Ok(values);
        });

        group.MapPut("/libraries/{libraryId:guid}/games/{gameId:guid}/values", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid gameId,
            List<CogitaGameValueUpsertRequest> request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var exists = await dbContext.CogitaGames.AsNoTracking().AnyAsync(x => x.Id == gameId && x.LibraryId == libraryId, ct);
            if (!exists)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var idsInRequest = request.Where(x => x.ValueId.HasValue).Select(x => x.ValueId!.Value).ToHashSet();
            var existingValues = await dbContext.CogitaGameValues.Where(x => x.GameId == gameId).ToListAsync(ct);

            var toRemove = existingValues.Where(x => !idsInRequest.Contains(x.Id)).ToList();
            if (toRemove.Count > 0)
            {
                dbContext.CogitaGameValues.RemoveRange(toRemove);
            }

            foreach (var item in request)
            {
                var valueKey = (item.ValueKey ?? string.Empty).Trim();
                var name = (item.Name ?? string.Empty).Trim();
                if (valueKey.Length == 0 || name.Length == 0)
                {
                    continue;
                }

                var target = item.ValueId.HasValue
                    ? existingValues.FirstOrDefault(x => x.Id == item.ValueId.Value)
                    : null;

                if (target is null)
                {
                    target = new CogitaGameValue
                    {
                        Id = item.ValueId ?? Guid.NewGuid(),
                        GameId = gameId,
                        CreatedUtc = now
                    };
                    dbContext.CogitaGameValues.Add(target);
                }

                target.ValueKey = valueKey.Length > 96 ? valueKey[..96] : valueKey;
                target.Name = name.Length > 160 ? name[..160] : name;
                target.ScopeType = NormalizeScopeType(item.ScopeType);
                target.Visibility = NormalizeVisibility(item.Visibility);
                target.DataType = NormalizeDataType(item.DataType);
                target.DefaultValueJson = item.DefaultValue.HasValue ? item.DefaultValue.Value.GetRawText() : "0";
                target.ConstraintsJson = item.Constraints.HasValue ? item.Constraints.Value.GetRawText() : null;
                target.IsScore = item.IsScore;
                target.UpdatedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            var response = await dbContext.CogitaGameValues.AsNoTracking()
                .Where(x => x.GameId == gameId)
                .OrderBy(x => x.Name)
                .Select(x => new CogitaGameValueResponse(
                    x.Id,
                    x.ValueKey,
                    x.Name,
                    x.ScopeType,
                    x.Visibility,
                    x.DataType,
                    ParseOptionalJson(x.DefaultValueJson),
                    ParseOptionalJson(x.ConstraintsJson),
                    x.IsScore,
                    x.UpdatedUtc))
                .ToListAsync(ct);

            return Results.Ok(response);
        });

        group.MapGet("/libraries/{libraryId:guid}/games/{gameId:guid}/actions/graph", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid gameId,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var graph = await dbContext.CogitaGameActionGraphs.AsNoTracking()
                .Where(x => x.GameId == gameId)
                .OrderByDescending(x => x.Version)
                .FirstOrDefaultAsync(ct);
            if (graph is null)
            {
                return Results.Ok(new CogitaGameActionGraphResponse(Guid.Empty, 0, "draft", new List<CogitaGameActionNodeResponse>(), new List<CogitaGameActionEdgeResponse>()));
            }

            var nodes = await dbContext.CogitaGameActionNodes.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .OrderBy(x => x.NodeType)
                .Select(x => new CogitaGameActionNodeResponse(
                    x.Id,
                    x.NodeType,
                    ParseOptionalJson(x.ConfigJson) ?? EmptyObject(),
                    x.PositionX,
                    x.PositionY))
                .ToListAsync(ct);

            var edges = await dbContext.CogitaGameActionEdges.AsNoTracking()
                .Where(x => x.GraphId == graph.Id)
                .Select(x => new CogitaGameActionEdgeResponse(x.Id, x.FromNodeId, x.FromPort, x.ToNodeId, x.ToPort))
                .ToListAsync(ct);

            return Results.Ok(new CogitaGameActionGraphResponse(graph.Id, graph.Version, graph.Status, nodes, edges));
        });

        group.MapPut("/libraries/{libraryId:guid}/games/{gameId:guid}/actions/graph", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid gameId,
            CogitaGameActionGraphUpsertRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var gameExists = await dbContext.CogitaGames.AsNoTracking().AnyAsync(x => x.Id == gameId && x.LibraryId == libraryId, ct);
            if (!gameExists)
            {
                return Results.NotFound();
            }

            var now = DateTimeOffset.UtcNow;
            var nextVersion = (await dbContext.CogitaGameActionGraphs.AsNoTracking()
                .Where(x => x.GameId == gameId)
                .Select(x => (int?)x.Version)
                .MaxAsync(ct) ?? 0) + 1;

            if (request.Publish)
            {
                var currentlyPublished = await dbContext.CogitaGameActionGraphs
                    .Where(x => x.GameId == gameId && x.Status == "published")
                    .ToListAsync(ct);
                foreach (var item in currentlyPublished)
                {
                    item.Status = "draft";
                    item.UpdatedUtc = now;
                }
            }

            var graph = new CogitaGameActionGraph
            {
                Id = Guid.NewGuid(),
                GameId = gameId,
                Version = nextVersion,
                Status = request.Publish ? "published" : "draft",
                PublishedUtc = request.Publish ? now : null,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaGameActionGraphs.Add(graph);

            var nodes = new List<CogitaGameActionNode>();
            foreach (var nodeRequest in request.Nodes ?? new List<CogitaGameActionNodeRequest>())
            {
                nodes.Add(new CogitaGameActionNode
                {
                    Id = nodeRequest.NodeId ?? Guid.NewGuid(),
                    GraphId = graph.Id,
                    NodeType = (nodeRequest.NodeType ?? string.Empty).Trim(),
                    ConfigJson = nodeRequest.Config.ValueKind == JsonValueKind.Undefined ? "{}" : nodeRequest.Config.GetRawText(),
                    PositionX = nodeRequest.PositionX,
                    PositionY = nodeRequest.PositionY
                });
            }

            var edges = new List<CogitaGameActionEdge>();
            foreach (var edgeRequest in request.Edges ?? new List<CogitaGameActionEdgeRequest>())
            {
                edges.Add(new CogitaGameActionEdge
                {
                    Id = edgeRequest.EdgeId ?? Guid.NewGuid(),
                    GraphId = graph.Id,
                    FromNodeId = edgeRequest.FromNodeId,
                    FromPort = edgeRequest.FromPort,
                    ToNodeId = edgeRequest.ToNodeId,
                    ToPort = edgeRequest.ToPort
                });
            }

            if (nodes.Count > 0)
            {
                dbContext.CogitaGameActionNodes.AddRange(nodes);
            }

            if (edges.Count > 0)
            {
                dbContext.CogitaGameActionEdges.AddRange(edges);
            }

            await dbContext.SaveChangesAsync(ct);

            var responseNodes = nodes.Select(x => new CogitaGameActionNodeResponse(
                x.Id,
                x.NodeType,
                ParseOptionalJson(x.ConfigJson) ?? EmptyObject(),
                x.PositionX,
                x.PositionY)).ToList();

            var responseEdges = edges.Select(x => new CogitaGameActionEdgeResponse(x.Id, x.FromNodeId, x.FromPort, x.ToNodeId, x.ToPort)).ToList();

            return Results.Ok(new CogitaGameActionGraphResponse(graph.Id, graph.Version, graph.Status, responseNodes, responseEdges));
        });

        group.MapGet("/libraries/{libraryId:guid}/games/{gameId:guid}/layouts", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid gameId,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var exists = await dbContext.CogitaGames.AsNoTracking().AnyAsync(x => x.Id == gameId && x.LibraryId == libraryId, ct);
            if (!exists)
            {
                return Results.NotFound();
            }

            var layouts = await dbContext.CogitaGameLayouts.AsNoTracking()
                .Where(x => x.GameId == gameId)
                .OrderBy(x => x.RoleType)
                .Select(x => new CogitaGameLayoutResponse(x.Id, x.RoleType, ParseOptionalJson(x.LayoutJson) ?? EmptyObject(), x.UpdatedUtc))
                .ToListAsync(ct);

            return Results.Ok(layouts);
        });

        group.MapPut("/libraries/{libraryId:guid}/games/{gameId:guid}/layouts/{roleType}", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid gameId,
            string roleType,
            CogitaGameLayoutUpsertRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var exists = await dbContext.CogitaGames.AsNoTracking().AnyAsync(x => x.Id == gameId && x.LibraryId == libraryId, ct);
            if (!exists)
            {
                return Results.NotFound();
            }

            var normalizedRoleType = NormalizeLayoutRole(roleType);
            var now = DateTimeOffset.UtcNow;
            var layout = await dbContext.CogitaGameLayouts
                .FirstOrDefaultAsync(x => x.GameId == gameId && x.RoleType == normalizedRoleType, ct);

            if (layout is null)
            {
                layout = new CogitaGameLayout
                {
                    Id = Guid.NewGuid(),
                    GameId = gameId,
                    RoleType = normalizedRoleType,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.CogitaGameLayouts.Add(layout);
            }

            layout.LayoutJson = request.Layout.GetRawText();
            layout.UpdatedUtc = now;
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new CogitaGameLayoutResponse(layout.Id, layout.RoleType, ParseOptionalJson(layout.LayoutJson) ?? EmptyObject(), layout.UpdatedUtc));
        });

        group.MapGet("/libraries/{libraryId:guid}/game-sessions", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            Guid libraryId,
            Guid? gameId,
            int? limit,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var normalizedLimit = Math.Clamp(limit ?? 200, 1, 1000);
            var query = dbContext.CogitaGameSessions.AsNoTracking()
                .Where(x => x.LibraryId == libraryId);
            if (gameId.HasValue)
            {
                query = query.Where(x => x.GameId == gameId.Value);
            }

            var sessions = await query
                .OrderByDescending(x => x.UpdatedUtc)
                .Take(normalizedLimit)
                .Select(x => new CogitaGameSessionSummaryResponse(
                    x.Id,
                    x.GameId,
                    x.Status,
                    x.Phase,
                    x.RoundIndex,
                    x.Version,
                    x.CreatedUtc,
                    x.UpdatedUtc))
                .ToListAsync(ct);

            return Results.Ok(sessions);
        });

        group.MapPost("/libraries/{libraryId:guid}/game-sessions", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameSessionService gameSessionService,
            Guid libraryId,
            CogitaGameSessionCreateRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var game = await dbContext.CogitaGames.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.GameId && x.LibraryId == libraryId && !x.IsArchived, ct);
            if (game is null)
            {
                return Results.BadRequest(new { error = "Game not found in library." });
            }

            var roleId = await dbContext.CogitaLibraries.AsNoTracking()
                .Where(x => x.Id == libraryId)
                .Select(x => x.RoleId)
                .FirstOrDefaultAsync(ct);
            if (roleId == Guid.Empty)
            {
                return Results.BadRequest(new { error = "Library role is missing." });
            }

            var now = DateTimeOffset.UtcNow;
            var code = tokenService.GenerateCode(10);
            var hostSecret = tokenService.GenerateCode(24);
            var metaJson = JsonSerializer.Serialize(new
            {
                title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
                settings = request.SessionSettings,
                geofence = new { farDistanceM = 1200, nearDistanceM = 300, farIntervalSec = 120, nearIntervalSec = 20, activeIntervalSec = 5 }
            });

            var session = new CogitaGameSession
            {
                Id = Guid.NewGuid(),
                LibraryId = libraryId,
                GameId = request.GameId,
                HostRoleId = roleId,
                PublicCodeHash = tokenService.HashToken(code),
                HostSecretHash = tokenService.HashToken(hostSecret),
                Status = "lobby",
                Phase = "lobby",
                RoundIndex = 0,
                Version = 1,
                SessionMetaJson = metaJson,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.CogitaGameSessions.Add(session);

            var hostParticipant = new CogitaGameParticipant
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                GroupId = null,
                RoleType = "host",
                PersonRoleId = roleId,
                DisplayName = "Host",
                DisplayNameHash = tokenService.HashToken("Host"),
                ParticipantTokenHash = tokenService.HashToken(hostSecret),
                JoinedUtc = now,
                LastSeenUtc = now,
                IsConnected = true,
                SpoofRiskScore = 0
            };
            dbContext.CogitaGameParticipants.Add(hostParticipant);

            foreach (var groupRequest in request.Groups ?? new List<CogitaGameSessionGroupRequest>())
            {
                var groupKey = (groupRequest.GroupKey ?? string.Empty).Trim();
                if (groupKey.Length == 0) continue;

                dbContext.CogitaGameSessionGroups.Add(new CogitaGameSessionGroup
                {
                    Id = Guid.NewGuid(),
                    SessionId = session.Id,
                    GroupKey = groupKey.Length > 96 ? groupKey[..96] : groupKey,
                    DisplayName = string.IsNullOrWhiteSpace(groupRequest.DisplayName) ? groupKey : groupRequest.DisplayName.Trim(),
                    Capacity = Math.Clamp(groupRequest.Capacity ?? 8, 1, 200),
                    IsActive = true,
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
            }

            foreach (var zoneRequest in request.Zones ?? new List<CogitaGameSessionZoneRequest>())
            {
                var zoneKey = (zoneRequest.ZoneKey ?? string.Empty).Trim();
                if (zoneKey.Length == 0) continue;

                dbContext.CogitaGameZones.Add(new CogitaGameZone
                {
                    Id = Guid.NewGuid(),
                    SessionId = session.Id,
                    ZoneKey = zoneKey.Length > 96 ? zoneKey[..96] : zoneKey,
                    SourceType = NormalizeZoneSource(zoneRequest.SourceType),
                    GeometryJson = JsonSerializer.Serialize(new { lat = zoneRequest.Latitude, lon = zoneRequest.Longitude }),
                    TriggerRadiusM = Math.Max(1m, zoneRequest.TriggerRadiusM),
                    IsEnabled = true,
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
            }

            await dbContext.SaveChangesAsync(ct);

            await gameSessionService.AppendEventAsync(session.Id, "SessionCreated", new { sessionId = session.Id }, hostParticipant.Id, Guid.NewGuid(), null, ct);
            await gameSessionService.RecomputeScoreboardAsync(session.Id, ct);

            var hostRealtimeToken = tokenService.IssueRealtimeToken(session.Id, hostParticipant.Id, isHost: true, TimeSpan.FromHours(2));
            var state = await gameSessionService.BuildStateAsync(session, null, hostRealtimeToken, null, ct);

            return Results.Ok(new CogitaGameSessionHostCreateResponse(session.Id, code, hostSecret, state));
        });

        group.MapPost("/libraries/{libraryId:guid}/game-sessions/{sessionId:guid}/host/attach", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameSessionService gameSessionService,
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaGameSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (!tokenService.MatchesHash(hostSecret, session.HostSecretHash))
            {
                return Results.Forbid();
            }

            var hostParticipant = await dbContext.CogitaGameParticipants.AsNoTracking()
                .FirstOrDefaultAsync(x => x.SessionId == sessionId && x.RoleType == "host", ct);
            var hostRealtimeToken = tokenService.IssueRealtimeToken(session.Id, hostParticipant?.Id, isHost: true, TimeSpan.FromHours(2));
            var state = await gameSessionService.BuildStateAsync(session, null, hostRealtimeToken, null, ct);
            return Results.Ok(state);
        });

        group.MapPost("/libraries/{libraryId:guid}/game-sessions/{sessionId:guid}/host/phase", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameSessionService gameSessionService,
            IGameRealtimeService realtimeService,
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            CogitaGameHostPhaseUpdateRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaGameSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (!tokenService.MatchesHash(hostSecret, session.HostSecretHash))
            {
                return Results.Forbid();
            }

            var previousPhase = NormalizePhase(session.Phase);
            var nextPhase = NormalizePhase(request.Phase);
            if (!IsAllowedPhaseTransition(previousPhase, nextPhase))
            {
                return Results.BadRequest(new
                {
                    error = $"Invalid phase transition from '{previousPhase}' to '{nextPhase}'."
                });
            }

            var now = DateTimeOffset.UtcNow;
            session.Phase = nextPhase;
            session.RoundIndex = Math.Max(0, request.RoundIndex);
            session.Status = request.Status is not null
                ? NormalizeStatus(request.Status)
                : DeriveStatusFromPhase(nextPhase);
            session.UpdatedUtc = now;
            if (session.Phase == "active_round" && !session.StartedUtc.HasValue)
            {
                session.StartedUtc = now;
            }
            if (session.Phase == "finished")
            {
                session.FinishedUtc = now;
            }

            await dbContext.SaveChangesAsync(ct);

            var hostParticipant = await dbContext.CogitaGameParticipants.AsNoTracking()
                .FirstOrDefaultAsync(x => x.SessionId == sessionId && x.RoleType == "host", ct);
            var phaseEvent = await gameSessionService.AppendEventAsync(
                sessionId,
                "SessionPhaseChanged",
                new
                {
                    previousPhase,
                    phase = session.Phase,
                    status = session.Status,
                    roundIndex = session.RoundIndex,
                    meta = request.Meta
                },
                hostParticipant?.Id,
                Guid.NewGuid(),
                null,
                ct);

            var snapshot = await gameSessionService.BuildStateAsync(
                session,
                null,
                tokenService.IssueRealtimeToken(session.Id, hostParticipant?.Id, true, TimeSpan.FromHours(2)),
                null,
                ct);
            await realtimeService.PublishEventAsync(session.Id, ToEventResponse(phaseEvent), ct);
            await realtimeService.PublishPhaseChangedAsync(session.Id, session.Phase, session.RoundIndex, session.Status, ct);
            await realtimeService.PublishScoreboardAsync(session.Id, snapshot.Scoreboard, snapshot.Version, ct);
            await realtimeService.PublishSnapshotAsync(session.Id, snapshot, ct);
            return Results.Ok(snapshot);
        });

        group.MapPost("/libraries/{libraryId:guid}/game-sessions/{sessionId:guid}/host/commands", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameSessionService gameSessionService,
            IGameRealtimeService realtimeService,
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            CogitaGameHostCommandRequest request,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaGameSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (!tokenService.MatchesHash(hostSecret, session.HostSecretHash))
            {
                return Results.Forbid();
            }

            var hostParticipant = await dbContext.CogitaGameParticipants.AsNoTracking()
                .FirstOrDefaultAsync(x => x.SessionId == sessionId && x.RoleType == "host", ct);

            var commandEvent = await gameSessionService.AppendEventAsync(
                session.Id,
                "HostCommand",
                new { command = request.Command, payload = request.Payload },
                hostParticipant?.Id,
                Guid.NewGuid(),
                null,
                ct);

            var snapshot = await gameSessionService.BuildStateAsync(
                session,
                null,
                tokenService.IssueRealtimeToken(session.Id, hostParticipant?.Id, true, TimeSpan.FromHours(2)),
                null,
                ct);

            await realtimeService.PublishEventAsync(session.Id, ToEventResponse(commandEvent), ct);
            await realtimeService.PublishSnapshotAsync(session.Id, snapshot, ct);
            return Results.Ok(snapshot);
        });

        group.MapPost("/libraries/{libraryId:guid}/game-sessions/{sessionId:guid}/host/groups", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            Guid libraryId,
            Guid sessionId,
            string hostSecret,
            List<CogitaGameSessionGroupRequest> request,
            IGameSessionService gameSessionService,
            IGameRealtimeService realtimeService,
            CancellationToken ct) =>
        {
            if (!await CogitaCoreEndpoints.HasLibraryAccess(context, dbContext, libraryId, ct))
            {
                return Results.Forbid();
            }

            var session = await dbContext.CogitaGameSessions
                .FirstOrDefaultAsync(x => x.Id == sessionId && x.LibraryId == libraryId, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            if (!tokenService.MatchesHash(hostSecret, session.HostSecretHash))
            {
                return Results.Forbid();
            }

            var now = DateTimeOffset.UtcNow;
            var existing = await dbContext.CogitaGameSessionGroups.Where(x => x.SessionId == sessionId).ToListAsync(ct);
            var requestKeys = request.Select(x => (x.GroupKey ?? string.Empty).Trim()).Where(x => x.Length > 0).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var toDelete = existing.Where(x => !requestKeys.Contains(x.GroupKey)).ToList();
            if (toDelete.Count > 0)
            {
                dbContext.CogitaGameSessionGroups.RemoveRange(toDelete);
            }

            foreach (var item in request)
            {
                var key = (item.GroupKey ?? string.Empty).Trim();
                if (key.Length == 0) continue;

                var target = existing.FirstOrDefault(x => string.Equals(x.GroupKey, key, StringComparison.OrdinalIgnoreCase));
                if (target is null)
                {
                    target = new CogitaGameSessionGroup
                    {
                        Id = Guid.NewGuid(),
                        SessionId = sessionId,
                        GroupKey = key,
                        DisplayName = string.IsNullOrWhiteSpace(item.DisplayName) ? key : item.DisplayName.Trim(),
                        Capacity = Math.Clamp(item.Capacity ?? 8, 1, 200),
                        IsActive = true,
                        CreatedUtc = now,
                        UpdatedUtc = now
                    };
                    dbContext.CogitaGameSessionGroups.Add(target);
                }
                else
                {
                    target.DisplayName = string.IsNullOrWhiteSpace(item.DisplayName) ? target.DisplayName : item.DisplayName.Trim();
                    target.Capacity = Math.Clamp(item.Capacity ?? target.Capacity, 1, 200);
                    target.UpdatedUtc = now;
                }
            }

            await dbContext.SaveChangesAsync(ct);

            var hostParticipant = await dbContext.CogitaGameParticipants.AsNoTracking()
                .FirstOrDefaultAsync(x => x.SessionId == sessionId && x.RoleType == "host", ct);
            var updatedEvent = await gameSessionService.AppendEventAsync(
                sessionId,
                "GroupConfigurationUpdated",
                new { groups = request.Count },
                hostParticipant?.Id,
                Guid.NewGuid(),
                null,
                ct);

            var groups = await dbContext.CogitaGameSessionGroups.AsNoTracking()
                .Where(x => x.SessionId == sessionId)
                .OrderBy(x => x.DisplayName)
                .Select(x => new CogitaGameSessionGroupResponse(x.Id, x.GroupKey, x.DisplayName, x.Capacity, x.IsActive))
                .ToListAsync(ct);

            var updatedSession = await dbContext.CogitaGameSessions.AsNoTracking()
                .FirstAsync(x => x.Id == sessionId, ct);
            var snapshot = await gameSessionService.BuildStateAsync(
                updatedSession,
                null,
                tokenService.IssueRealtimeToken(updatedSession.Id, hostParticipant?.Id, true, TimeSpan.FromHours(2)),
                null,
                ct);
            await realtimeService.PublishEventAsync(sessionId, ToEventResponse(updatedEvent), ct);
            await realtimeService.PublishSnapshotAsync(sessionId, snapshot, ct);

            return Results.Ok(groups);
        });

        group.MapPost("/game/maintenance/cleanup-location", async (
            IGameSessionService gameSessionService,
            CancellationToken ct) =>
        {
            var removed = await gameSessionService.CleanupLocationRetentionAsync(ct);
            return Results.Ok(new { removed });
        });
    }

    private static void MapPublic(RouteGroupBuilder group)
    {
        group.MapPost("/{code}/join", async (
            string code,
            CogitaGameSessionJoinRequest request,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameSessionService gameSessionService,
            IGameRealtimeService realtimeService,
            CancellationToken ct) =>
        {
            var session = await FindSessionByCodeAsync(code, dbContext, tokenService, ct);
            if (session is null)
            {
                return Results.NotFound(new { error = "Session not found." });
            }

            var now = DateTimeOffset.UtcNow;
            var normalizedName = string.IsNullOrWhiteSpace(request.Name) ? "Participant" : request.Name.Trim();
            if (normalizedName.Length > 120)
            {
                normalizedName = normalizedName[..120];
            }

            var group = string.IsNullOrWhiteSpace(request.GroupKey)
                ? null
                : await dbContext.CogitaGameSessionGroups.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.GroupKey == request.GroupKey.Trim(), ct);

            var participantToken = tokenService.GenerateCode(24);
            var participant = new CogitaGameParticipant
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                GroupId = group?.Id,
                RoleType = "participant",
                PersonRoleId = null,
                DisplayName = normalizedName,
                DisplayNameHash = tokenService.HashToken(normalizedName),
                ParticipantTokenHash = tokenService.HashToken(participantToken),
                DeviceHash = string.IsNullOrWhiteSpace(request.DeviceId) ? null : tokenService.HashToken(request.DeviceId),
                JoinedUtc = now,
                LastSeenUtc = now,
                IsConnected = true,
                SpoofRiskScore = 0
            };

            dbContext.CogitaGameParticipants.Add(participant);
            await dbContext.SaveChangesAsync(ct);

            var joinedEvent = await gameSessionService.AppendEventAsync(
                session.Id,
                "ParticipantJoined",
                new { participantId = participant.Id, name = participant.DisplayName, groupId = participant.GroupId },
                participant.Id,
                Guid.NewGuid(),
                null,
                ct);

            var realtimeToken = tokenService.IssueRealtimeToken(session.Id, participant.Id, false, TimeSpan.FromHours(2));
            var state = await gameSessionService.BuildStateAsync(session, null, null, realtimeToken, ct);
            await realtimeService.PublishEventAsync(session.Id, ToEventResponse(joinedEvent), ct);
            await realtimeService.PublishSnapshotAsync(session.Id, state, ct);

            return Results.Ok(new CogitaGameSessionJoinResponse(session.Id, participant.Id, participantToken, state));
        });

        group.MapGet("/{code}/state", async (
            HttpContext context,
            string code,
            string? participantToken,
            long? sinceSeq,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameSessionService gameSessionService,
            CancellationToken ct) =>
        {
            var session = await FindSessionByCodeAsync(code, dbContext, tokenService, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            string? participantRealtimeToken = null;
            if (!string.IsNullOrWhiteSpace(participantToken))
            {
                var sessionParticipants = await dbContext.CogitaGameParticipants.AsNoTracking()
                    .Where(x => x.SessionId == session.Id)
                    .ToListAsync(ct);
                var participant = sessionParticipants
                    .FirstOrDefault(x => tokenService.MatchesHash(participantToken, x.ParticipantTokenHash));
                if (participant is not null)
                {
                    participantRealtimeToken = tokenService.IssueRealtimeToken(session.Id, participant.Id, false, TimeSpan.FromHours(2));
                }
            }

            var state = await gameSessionService.BuildStateAsync(session, sinceSeq, null, participantRealtimeToken, ct);
            var stateHash = gameSessionService.ComputeStateHash(state);
            if (RequestMatchesStateHash(context, stateHash))
            {
                SetStateHashHeaders(context, stateHash);
                return Results.StatusCode(StatusCodes.Status304NotModified);
            }

            SetStateHashHeaders(context, stateHash);
            return Results.Ok(new CogitaGameStateQueryResponse(state, stateHash));
        });

        group.MapPost("/{code}/location-pings", async (
            string code,
            CogitaGameLocationPingRequest request,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameLocationService locationService,
            IGameRuleEngineService ruleEngine,
            IGameSessionService gameSessionService,
            IGameRealtimeService realtimeService,
            CancellationToken ct) =>
        {
            var session = await FindSessionByCodeAsync(code, dbContext, tokenService, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var participant = await ResolveParticipantByTokenAsync(request.ParticipantToken, session.Id, dbContext, tokenService, ct);
            if (participant is null)
            {
                return Results.Forbid();
            }

            var baselineSeqNo = await GetLastSeqNoAsync(session.Id, dbContext, ct);
            await locationService.ProcessLocationBatchAsync(session, participant, request, ct);

            var newlyCreatedEvents = await dbContext.CogitaGameEventLogs.AsNoTracking()
                .Where(x => x.SessionId == session.Id && x.SeqNo > baselineSeqNo)
                .OrderBy(x => x.SeqNo)
                .ToListAsync(ct);

            foreach (var gameEvent in newlyCreatedEvents.Where(x => string.Equals(x.EventType, "ZoneEnter", StringComparison.Ordinal)))
            {
                await ruleEngine.EvaluateEventAsync(session, gameEvent, ct);
            }

            var deltaEvents = await dbContext.CogitaGameEventLogs.AsNoTracking()
                .Where(x => x.SessionId == session.Id && x.SeqNo > baselineSeqNo)
                .OrderBy(x => x.SeqNo)
                .ToListAsync(ct);
            foreach (var item in deltaEvents.Where(x => IsRealtimeBroadcastEvent(x.EventType)))
            {
                await realtimeService.PublishEventAsync(session.Id, ToEventResponse(item), ct);
            }

            var updatedSession = await dbContext.CogitaGameSessions.AsNoTracking().FirstAsync(x => x.Id == session.Id, ct);
            var state = await gameSessionService.BuildStateAsync(
                updatedSession,
                null,
                null,
                tokenService.IssueRealtimeToken(updatedSession.Id, participant.Id, false, TimeSpan.FromHours(2)),
                ct);

            await realtimeService.PublishScoreboardAsync(updatedSession.Id, state.Scoreboard, state.Version, ct);
            await realtimeService.PublishSnapshotAsync(updatedSession.Id, state, ct);
            return Results.Ok(new { accepted = true, events = deltaEvents.Count, lastSeqNo = state.LastSeqNo });
        });

        group.MapPost("/{code}/answers", async (
            string code,
            CogitaGameAnswerSubmitRequest request,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameRuleEngineService ruleEngine,
            IGameSessionService gameSessionService,
            IGameRealtimeService realtimeService,
            CancellationToken ct) =>
        {
            var session = await FindSessionByCodeAsync(code, dbContext, tokenService, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var participant = await ResolveParticipantByTokenAsync(request.ParticipantToken, session.Id, dbContext, tokenService, ct);
            if (participant is null)
            {
                return Results.Forbid();
            }

            var baselineSeqNo = await GetLastSeqNoAsync(session.Id, dbContext, ct);
            var answerEvent = await gameSessionService.AppendEventAsync(
                session.Id,
                "AnswerSubmitted",
                new { participantId = participant.Id, groupId = participant.GroupId, interactionKey = request.InteractionKey, answer = request.Answer },
                participant.Id,
                Guid.NewGuid(),
                null,
                ct);

            await ruleEngine.EvaluateEventAsync(session, answerEvent, ct);

            var deltaEvents = await dbContext.CogitaGameEventLogs.AsNoTracking()
                .Where(x => x.SessionId == session.Id && x.SeqNo > baselineSeqNo)
                .OrderBy(x => x.SeqNo)
                .ToListAsync(ct);
            foreach (var item in deltaEvents.Where(x => IsRealtimeBroadcastEvent(x.EventType)))
            {
                await realtimeService.PublishEventAsync(session.Id, ToEventResponse(item), ct);
            }

            var updatedSession = await dbContext.CogitaGameSessions.AsNoTracking().FirstAsync(x => x.Id == session.Id, ct);
            var state = await gameSessionService.BuildStateAsync(
                updatedSession,
                null,
                null,
                tokenService.IssueRealtimeToken(updatedSession.Id, participant.Id, false, TimeSpan.FromHours(2)),
                ct);
            await realtimeService.PublishScoreboardAsync(updatedSession.Id, state.Scoreboard, state.Version, ct);
            await realtimeService.PublishSnapshotAsync(updatedSession.Id, state, ct);
            return Results.Ok(new { accepted = true, seqNo = answerEvent.SeqNo });
        });

        group.MapPost("/{code}/interactions/{interactionKey}/complete", async (
            string code,
            string interactionKey,
            CogitaGameInteractionCompleteRequest request,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameRuleEngineService ruleEngine,
            IGameSessionService gameSessionService,
            IGameRealtimeService realtimeService,
            CancellationToken ct) =>
        {
            var session = await FindSessionByCodeAsync(code, dbContext, tokenService, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var participant = await ResolveParticipantByTokenAsync(request.ParticipantToken, session.Id, dbContext, tokenService, ct);
            if (participant is null)
            {
                return Results.Forbid();
            }

            var baselineSeqNo = await GetLastSeqNoAsync(session.Id, dbContext, ct);
            var interactionEvent = await gameSessionService.AppendEventAsync(
                session.Id,
                "InteractionCompleted",
                new { participantId = participant.Id, groupId = participant.GroupId, interactionKey, payload = request.Payload },
                participant.Id,
                Guid.NewGuid(),
                null,
                ct);

            await ruleEngine.EvaluateEventAsync(session, interactionEvent, ct);

            var deltaEvents = await dbContext.CogitaGameEventLogs.AsNoTracking()
                .Where(x => x.SessionId == session.Id && x.SeqNo > baselineSeqNo)
                .OrderBy(x => x.SeqNo)
                .ToListAsync(ct);
            foreach (var item in deltaEvents.Where(x => IsRealtimeBroadcastEvent(x.EventType)))
            {
                await realtimeService.PublishEventAsync(session.Id, ToEventResponse(item), ct);
            }

            var updatedSession = await dbContext.CogitaGameSessions.AsNoTracking().FirstAsync(x => x.Id == session.Id, ct);
            var state = await gameSessionService.BuildStateAsync(
                updatedSession,
                null,
                null,
                tokenService.IssueRealtimeToken(updatedSession.Id, participant.Id, false, TimeSpan.FromHours(2)),
                ct);
            await realtimeService.PublishScoreboardAsync(updatedSession.Id, state.Scoreboard, state.Version, ct);
            await realtimeService.PublishSnapshotAsync(updatedSession.Id, state, ct);
            return Results.Ok(new { accepted = true, seqNo = interactionEvent.SeqNo });
        });

        group.MapPost("/{code}/leave", async (
            string code,
            CogitaGameLeaveRequest request,
            RecreatioDbContext dbContext,
            IGameTokenService tokenService,
            IGameSessionService gameSessionService,
            IGameRealtimeService realtimeService,
            CancellationToken ct) =>
        {
            var session = await FindSessionByCodeAsync(code, dbContext, tokenService, ct);
            if (session is null)
            {
                return Results.NotFound();
            }

            var participant = await ResolveParticipantByTokenAsync(request.ParticipantToken, session.Id, dbContext, tokenService, ct);
            if (participant is null)
            {
                return Results.Forbid();
            }

            participant.IsConnected = false;
            participant.LastSeenUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(ct);

            var leftEvent = await gameSessionService.AppendEventAsync(
                session.Id,
                "ParticipantLeft",
                new { participantId = participant.Id },
                participant.Id,
                Guid.NewGuid(),
                null,
                ct);

            var updatedSession = await dbContext.CogitaGameSessions.AsNoTracking().FirstAsync(x => x.Id == session.Id, ct);
            var state = await gameSessionService.BuildStateAsync(updatedSession, null, null, null, ct);
            await realtimeService.PublishEventAsync(session.Id, ToEventResponse(leftEvent), ct);
            await realtimeService.PublishSnapshotAsync(session.Id, state, ct);

            return Results.Ok(new { left = true });
        });
    }

    private static async Task<CogitaGameSession?> FindSessionByCodeAsync(
        string code,
        RecreatioDbContext dbContext,
        IGameTokenService tokenService,
        CancellationToken ct)
    {
        var normalized = (code ?? string.Empty).Trim();
        if (normalized.Length == 0)
        {
            return null;
        }

        var sessions = await dbContext.CogitaGameSessions
            .ToListAsync(ct);
        return sessions.FirstOrDefault(x => tokenService.MatchesHash(normalized, x.PublicCodeHash));
    }

    private static async Task<CogitaGameParticipant?> ResolveParticipantByTokenAsync(
        string token,
        Guid sessionId,
        RecreatioDbContext dbContext,
        IGameTokenService tokenService,
        CancellationToken ct)
    {
        var participants = await dbContext.CogitaGameParticipants
            .Where(x => x.SessionId == sessionId)
            .ToListAsync(ct);

        return participants.FirstOrDefault(x => tokenService.MatchesHash(token, x.ParticipantTokenHash));
    }

    private static async Task<long> GetLastSeqNoAsync(Guid sessionId, RecreatioDbContext dbContext, CancellationToken ct)
    {
        return await dbContext.CogitaGameEventLogs.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .MaxAsync(x => (long?)x.SeqNo, ct) ?? 0;
    }

    private static string NormalizeGameMode(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "solo" || normalized == "group")
        {
            return normalized;
        }

        return "mixed";
    }

    private static string NormalizeScopeType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "session" || normalized == "group")
        {
            return normalized;
        }

        return "participant";
    }

    private static string NormalizeVisibility(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "group" || normalized == "private")
        {
            return normalized;
        }

        return "public";
    }

    private static string NormalizeDataType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "bool" || normalized == "string")
        {
            return normalized;
        }

        return "number";
    }

    private static string NormalizeLayoutRole(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "host" || normalized == "groupleader")
        {
            return normalized;
        }

        return "participant";
    }

    private static string NormalizeZoneSource(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "storyboard")
        {
            return normalized;
        }

        return "manual";
    }

    private static string NormalizePhase(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "active_round" => "active_round",
            "reveal" => "reveal",
            "transition" => "transition",
            "paused" => "paused",
            "finished" => "finished",
            _ => "lobby"
        };
    }

    private static bool IsAllowedPhaseTransition(string currentPhase, string nextPhase)
    {
        var current = NormalizePhase(currentPhase);
        var next = NormalizePhase(nextPhase);
        if (current == next)
        {
            return true;
        }

        return current switch
        {
            "lobby" => next is "active_round" or "paused" or "finished",
            "active_round" => next is "reveal" or "transition" or "paused" or "finished",
            "reveal" => next is "transition" or "active_round" or "paused" or "finished",
            "transition" => next is "active_round" or "reveal" or "paused" or "finished",
            "paused" => next is "lobby" or "active_round" or "reveal" or "transition" or "finished",
            "finished" => false,
            _ => false
        };
    }

    private static string DeriveStatusFromPhase(string phase)
    {
        var normalized = NormalizePhase(phase);
        return normalized switch
        {
            "finished" => "finished",
            "paused" => "paused",
            "lobby" => "lobby",
            _ => "active"
        };
    }

    private static string NormalizeStatus(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "active" => "active",
            "paused" => "paused",
            "finished" => "finished",
            _ => "lobby"
        };
    }

    private static bool IsRealtimeBroadcastEvent(string eventType)
    {
        if (string.Equals(eventType, "LocationPing", StringComparison.Ordinal))
        {
            return false;
        }

        return true;
    }

    private static JsonElement? ParseOptionalJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            return document.RootElement.Clone();
        }
        catch
        {
            return null;
        }
    }

    private static JsonElement EmptyObject()
    {
        using var document = JsonDocument.Parse("{}");
        return document.RootElement.Clone();
    }

    private static bool RequestMatchesStateHash(HttpContext context, string stateHash)
    {
        var ifNoneMatch = context.Request.Headers.IfNoneMatch.ToString();
        if (string.IsNullOrWhiteSpace(ifNoneMatch))
        {
            return false;
        }

        foreach (var token in ifNoneMatch.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var normalized = token;
            if (normalized.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
            {
                normalized = normalized[2..].Trim();
            }

            if (normalized.Length >= 2 && normalized[0] == '"' && normalized[^1] == '"')
            {
                normalized = normalized[1..^1];
            }

            if (string.Equals(normalized, stateHash, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static void SetStateHashHeaders(HttpContext context, string stateHash)
    {
        context.Response.Headers.ETag = $"\"{stateHash}\"";
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.Headers["X-Cogita-Game-State-Hash"] = stateHash;
    }

    private static CogitaGameEventResponse ToEventResponse(CogitaGameEventLog gameEvent)
    {
        JsonElement payload;
        try
        {
            using var document = JsonDocument.Parse(gameEvent.PayloadJson);
            payload = document.RootElement.Clone();
        }
        catch
        {
            using var empty = JsonDocument.Parse("{}");
            payload = empty.RootElement.Clone();
        }

        return new CogitaGameEventResponse(
            gameEvent.Id,
            gameEvent.SeqNo,
            gameEvent.EventType,
            gameEvent.CorrelationId,
            gameEvent.ActorParticipantId,
            payload,
            gameEvent.CreatedUtc);
    }
}
