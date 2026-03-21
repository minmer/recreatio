using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts.Cogita;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Cogita;

namespace Recreatio.Api.Services.Cogita;

public interface IGameLocationService
{
    Task<List<CogitaGameEventLog>> ProcessLocationBatchAsync(
        CogitaGameSession session,
        CogitaGameParticipant participant,
        CogitaGameLocationPingRequest request,
        CancellationToken ct);
}

public sealed class GameLocationService : IGameLocationService
{
    private readonly RecreatioDbContext dbContext;
    private readonly IGameSessionService gameSessionService;

    public GameLocationService(
        RecreatioDbContext dbContext,
        IGameSessionService gameSessionService)
    {
        this.dbContext = dbContext;
        this.gameSessionService = gameSessionService;
    }

    public async Task<List<CogitaGameEventLog>> ProcessLocationBatchAsync(
        CogitaGameSession session,
        CogitaGameParticipant participant,
        CogitaGameLocationPingRequest request,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var createdEvents = new List<CogitaGameEventLog>();
        var samples = request.Samples ?? new List<CogitaGameLocationPingSample>();
        if (samples.Count == 0)
        {
            return createdEvents;
        }

        var zones = await dbContext.CogitaGameZones
            .Where(x => x.SessionId == session.Id && x.IsEnabled)
            .ToListAsync(ct);

        var zoneIds = zones.Select(x => x.Id).ToList();
        var presenceRows = await dbContext.CogitaGamePresenceStates
            .Where(x => x.SessionId == session.Id && x.ParticipantId == participant.Id && zoneIds.Contains(x.ZoneId))
            .ToListAsync(ct);

        var presenceByZone = presenceRows.ToDictionary(x => x.ZoneId, x => x);

        var priorLocation = ParseLastLocation(participant.LastLocationMetaJson);
        var startingSpoofRisk = participant.SpoofRiskScore;
        var spoofRisk = participant.SpoofRiskScore;
        var repeatedSyntheticTraceCount = 0;
        string? previousGeoHash6 = null;

        foreach (var sample in samples)
        {
            var sampleTime = sample.DeviceTimeUtc;
            if (sampleTime > now.AddMinutes(5) || sampleTime < now.AddHours(-12))
            {
                sampleTime = now;
                spoofRisk += 5;
            }

            if (priorLocation is not null)
            {
                var dtSec = Math.Max(1, (sampleTime - priorLocation.Value.Timestamp).TotalSeconds);
                var distanceM = DistanceMeters(
                    priorLocation.Value.Latitude,
                    priorLocation.Value.Longitude,
                    Convert.ToDouble(sample.Latitude),
                    Convert.ToDouble(sample.Longitude));
                var speedMps = distanceM / dtSec;
                if (speedMps > 55)
                {
                    spoofRisk += 15;
                }
                else if (speedMps > 35)
                {
                    spoofRisk += 7;
                }

                if (distanceM < 3 && sample.AccuracyM <= 5m)
                {
                    repeatedSyntheticTraceCount += 1;
                    if (repeatedSyntheticTraceCount >= 3)
                    {
                        spoofRisk += 3;
                    }
                }
                else
                {
                    repeatedSyntheticTraceCount = 0;
                }
            }

            if (sample.AccuracyM > 0m && sample.AccuracyM < 1m)
            {
                spoofRisk += 2;
            }

            var geoHash6 = BuildGeoHash6(sample.Latitude, sample.Longitude);
            if (previousGeoHash6 is not null && string.Equals(previousGeoHash6, geoHash6, StringComparison.Ordinal) && sample.AccuracyM <= 3m)
            {
                repeatedSyntheticTraceCount += 1;
                if (repeatedSyntheticTraceCount >= 4)
                {
                    spoofRisk += 2;
                }
            }
            previousGeoHash6 = geoHash6;

            dbContext.CogitaGameLocationAudits.Add(new CogitaGameLocationAudit
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                ParticipantId = participant.Id,
                GeoHash6 = geoHash6,
                AccuracyBucket = BucketAccuracy(sample.AccuracyM),
                SpeedBucket = BucketSpeed(sample.SpeedMps),
                CreatedUtc = sampleTime
            });

            var accuracyBucket = BucketAccuracy(sample.AccuracyM);
            var speedBucket = BucketSpeed(sample.SpeedMps);
            var pingEvent = await gameSessionService.AppendEventAsync(
                session.Id,
                "LocationPing",
                new
                {
                    participantId = participant.Id,
                    groupId = participant.GroupId,
                    geoHash6,
                    accuracyBucket,
                    speedBucket,
                    deviceTimeUtc = sampleTime,
                    batchId = request.BatchId
                },
                participant.Id,
                Guid.NewGuid(),
                null,
                ct);
            createdEvents.Add(pingEvent);

            foreach (var zone in zones)
            {
                var zonePoint = ParseZonePoint(zone.GeometryJson);
                if (zonePoint is null)
                {
                    continue;
                }

                var distance = DistanceMeters(
                    zonePoint.Value.Latitude,
                    zonePoint.Value.Longitude,
                    Convert.ToDouble(sample.Latitude),
                    Convert.ToDouble(sample.Longitude));
                var inside = distance <= Convert.ToDouble(zone.TriggerRadiusM + sample.AccuracyM);
                var outsideForExit = distance > Convert.ToDouble(zone.TriggerRadiusM + 20m);

                if (!presenceByZone.TryGetValue(zone.Id, out var presence))
                {
                    presence = new CogitaGamePresenceState
                    {
                        Id = Guid.NewGuid(),
                        SessionId = session.Id,
                        ParticipantId = participant.Id,
                        ZoneId = zone.Id,
                        PresenceState = "outside",
                        LastPingUtc = sampleTime,
                        UpdatedUtc = now,
                        Confidence = 0m
                    };
                    presenceByZone[zone.Id] = presence;
                    dbContext.CogitaGamePresenceStates.Add(presence);
                }

                var confidence = Math.Max(0m, Math.Min(1m, 1m - (sample.AccuracyM / Math.Max(zone.TriggerRadiusM, 1m))));

                if (inside)
                {
                    if (string.Equals(presence.PresenceState, "outside", StringComparison.Ordinal))
                    {
                        presence.PresenceState = "candidate";
                        presence.EnteredUtc = sampleTime;
                        presence.ExitedUtc = null;
                    }
                    else if (string.Equals(presence.PresenceState, "candidate", StringComparison.Ordinal))
                    {
                        var dwell = sampleTime - (presence.EnteredUtc ?? sampleTime);
                        if (dwell.TotalSeconds >= 8)
                        {
                            presence.PresenceState = "inside";
                            var zoneEnterEvent = await gameSessionService.AppendEventAsync(
                                session.Id,
                                "ZoneEnter",
                                new
                                {
                                    participantId = participant.Id,
                                    groupId = participant.GroupId,
                                    zoneId = zone.Id,
                                    zoneKey = zone.ZoneKey,
                                    confidence,
                                    triggerRadiusM = zone.TriggerRadiusM
                                },
                                participant.Id,
                                Guid.NewGuid(),
                                pingEvent.Id,
                                ct);
                            createdEvents.Add(zoneEnterEvent);
                        }
                    }
                    else
                    {
                        presence.ExitedUtc = null;
                    }
                }
                else
                {
                    if (string.Equals(presence.PresenceState, "inside", StringComparison.Ordinal))
                    {
                        if (outsideForExit)
                        {
                            presence.ExitedUtc ??= sampleTime;
                            var outsideDuration = sampleTime - presence.ExitedUtc.Value;
                            if (outsideDuration.TotalSeconds >= 15)
                            {
                                presence.PresenceState = "outside";
                                presence.EnteredUtc = null;
                                var zoneExitEvent = await gameSessionService.AppendEventAsync(
                                    session.Id,
                                    "ZoneExit",
                                    new
                                    {
                                        participantId = participant.Id,
                                        groupId = participant.GroupId,
                                        zoneId = zone.Id,
                                        zoneKey = zone.ZoneKey,
                                        reason = "distance"
                                    },
                                    participant.Id,
                                    Guid.NewGuid(),
                                    pingEvent.Id,
                                    ct);
                                createdEvents.Add(zoneExitEvent);
                            }
                        }
                        else
                        {
                            presence.ExitedUtc = null;
                        }
                    }
                    else
                    {
                        presence.PresenceState = "outside";
                        presence.EnteredUtc = null;
                    }
                }

                presence.LastPingUtc = sampleTime;
                presence.Confidence = confidence;
                presence.UpdatedUtc = now;
            }

            priorLocation = new LastLocation(Convert.ToDouble(sample.Latitude), Convert.ToDouble(sample.Longitude), sampleTime);
        }

        participant.SpoofRiskScore = Math.Max(0m, Math.Min(100m, spoofRisk));
        participant.LastSeenUtc = now;
        participant.LastLocationMetaJson = JsonSerializer.Serialize(new
        {
            lat = priorLocation.HasValue ? Math.Round(priorLocation.Value.Latitude, 3, MidpointRounding.AwayFromZero) : null,
            lon = priorLocation.HasValue ? Math.Round(priorLocation.Value.Longitude, 3, MidpointRounding.AwayFromZero) : null,
            ts = priorLocation?.Timestamp
        });

        if (startingSpoofRisk < 60m && participant.SpoofRiskScore >= 60m)
        {
            var spoofEvent = await gameSessionService.AppendEventAsync(
                session.Id,
                "SpoofRiskFlagged",
                new
                {
                    participantId = participant.Id,
                    groupId = participant.GroupId,
                    score = participant.SpoofRiskScore
                },
                participant.Id,
                Guid.NewGuid(),
                null,
                ct);
            createdEvents.Add(spoofEvent);
        }

        await dbContext.SaveChangesAsync(ct);
        return createdEvents;
    }

    private static string BucketAccuracy(decimal accuracyM)
    {
        if (accuracyM <= 10m) return "high";
        if (accuracyM <= 40m) return "balanced";
        return "coarse";
    }

    private static string BucketSpeed(decimal? speedMps)
    {
        if (!speedMps.HasValue) return "unknown";
        if (speedMps.Value <= 1.5m) return "walk";
        if (speedMps.Value <= 6m) return "run";
        if (speedMps.Value <= 20m) return "vehicle";
        return "extreme";
    }

    private static string BuildGeoHash6(decimal latitude, decimal longitude)
    {
        var lat = Math.Round(latitude, 3, MidpointRounding.AwayFromZero);
        var lon = Math.Round(longitude, 3, MidpointRounding.AwayFromZero);
        return $"{lat:0.000}:{lon:0.000}";
    }

    private static ZonePoint? ParseZonePoint(string geometryJson)
    {
        if (string.IsNullOrWhiteSpace(geometryJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(geometryJson);
            var root = document.RootElement;
            if (!root.TryGetProperty("lat", out var latNode) || !root.TryGetProperty("lon", out var lonNode))
            {
                return null;
            }

            if (!latNode.TryGetDouble(out var lat) || !lonNode.TryGetDouble(out var lon))
            {
                return null;
            }

            return new ZonePoint(lat, lon);
        }
        catch
        {
            return null;
        }
    }

    private static LastLocation? ParseLastLocation(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (!root.TryGetProperty("lat", out var latNode) || !root.TryGetProperty("lon", out var lonNode) || !root.TryGetProperty("ts", out var tsNode))
            {
                return null;
            }

            if (!latNode.TryGetDouble(out var lat) || !lonNode.TryGetDouble(out var lon))
            {
                return null;
            }

            if (!tsNode.TryGetDateTimeOffset(out var ts))
            {
                return null;
            }

            return new LastLocation(lat, lon, ts);
        }
        catch
        {
            return null;
        }
    }

    private static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusM = 6371000;
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2))
                * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusM * c;
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180.0;
    }

    private readonly record struct ZonePoint(double Latitude, double Longitude);
    private readonly record struct LastLocation(double Latitude, double Longitude, DateTimeOffset Timestamp);
}
