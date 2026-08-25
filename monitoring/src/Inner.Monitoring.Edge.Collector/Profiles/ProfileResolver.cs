using System.Text.Json;
using Inner.Monitoring.Domain.Entities;

namespace Inner.Monitoring.Edge.Collector.Profiles;

/// <summary>
///     Resultado de uma query de perfil.
/// </summary>
public sealed class ProfileQuery
{
    public required string Operation { get; init; } // "get", "walk", "bulk_walk"
    public string[] Oids { get; init; } = [];
    public string? RootOid { get; init; }
    public int? MaxVariables { get; init; }
}

/// <summary>
///     Perfil de coleta declarativo.
/// </summary>
public sealed class DeclarativeProfile
{
    public required string ProfileId { get; init; }
    public required string ProfileType { get; init; }
    public int PollIntervalSeconds { get; init; } = 300;
    public int Priority { get; init; } = 100;
    public required ProfileQuery[] Queries { get; init; }
    public Dictionary<string, string> Properties { get; init; } = new();
}

/// <summary>
///     Interface para resolver perfis de coleta por tipo de dispositivo.
/// </summary>
public interface IProfileResolver
{
    /// <summary>
    ///     Resolve o perfil para um tipo de dispositivo.
    /// </summary>
    Task<CollectionProfile?> ResolveProfileAsync(string deviceType, CancellationToken ct);

    /// <summary>
    ///     Resolve o perfil declarativo para um tipo de dispositivo.
    /// </summary>
    DeclarativeProfile? GetDeclarativeProfile(string deviceType);
}

/// <summary>
///     Implementação de resolvedor de perfis.
///     Mapeia tipos de dispositivo para perfis de coleta.
/// </summary>
public sealed class ProfileResolver : IProfileResolver
{
    // Perfil MIB-II base para todos os dispositivos de rede
    private static readonly DeclarativeProfile Mib2NetworkBase = new()
    {
        ProfileId = "mib2-network-base",
        ProfileType = "network_device",
        PollIntervalSeconds = 300,
        Priority = 100,
        Queries = new ProfileQuery[]
        {
            new ProfileQuery { Operation = "get", Oids = new[] { "1.3.6.1.2.1.1.3.0" } },
            new ProfileQuery { Operation = "bulk_walk", RootOid = "1.3.6.1.2.1.2.2", MaxVariables = 100 }
        },
        Properties = new Dictionary<string, string>
        {
            ["supports_mib2"] = "true"
        }
    };

    // Perfis específicos por tipo de dispositivo
    private static readonly Dictionary<string, DeclarativeProfile> ProfilesByType = new()
    {
        ["switch"] = new DeclarativeProfile
        {
            ProfileId = "switch-standard",
            ProfileType = "switch",
            PollIntervalSeconds = 300,
            Priority = 90,
            Queries = new ProfileQuery[]
            {
                new ProfileQuery { Operation = "get", Oids = new[] { "1.3.6.1.2.1.1.3.0" } },
                new ProfileQuery { Operation = "bulk_walk", RootOid = "1.3.6.1.2.1.2.2", MaxVariables = 100 },
                new ProfileQuery { Operation = "walk", RootOid = "1.3.6.1.2.1.17" },
                new ProfileQuery { Operation = "walk", RootOid = "1.3.6.1.2.1.17.4" }
            },
            Properties = new Dictionary<string, string>
            {
                ["supports_mib2"] = "true",
                ["supports_bridge"] = "true"
            }
        },

        ["router"] = new DeclarativeProfile
        {
            ProfileId = "router-standard",
            ProfileType = "router",
            PollIntervalSeconds = 300,
            Priority = 85,
            Queries = new ProfileQuery[]
            {
                new ProfileQuery { Operation = "get", Oids = new[] { "1.3.6.1.2.1.1.3.0" } },
                new ProfileQuery { Operation = "bulk_walk", RootOid = "1.3.6.1.2.1.2.2", MaxVariables = 100 },
                new ProfileQuery { Operation = "bulk_walk", RootOid = "1.3.6.1.2.1.4.20", MaxVariables = 50 },
                new ProfileQuery { Operation = "walk", RootOid = "1.3.6.1.2.1.4.21" }
            },
            Properties = new Dictionary<string, string>
            {
                ["supports_mib2"] = "true",
                ["supports_ip"] = "true"
            }
        },

        ["access_point"] = new DeclarativeProfile
        {
            ProfileId = "access-point-standard",
            ProfileType = "access_point",
            PollIntervalSeconds = 300,
            Priority = 80,
            Queries = new ProfileQuery[]
            {
                new ProfileQuery { Operation = "get", Oids = new[] { "1.3.6.1.2.1.1.3.0" } },
                new ProfileQuery { Operation = "bulk_walk", RootOid = "1.3.6.1.2.1.2.2", MaxVariables = 100 }
            },
            Properties = new Dictionary<string, string>
            {
                ["supports_mib2"] = "true",
                ["supports_wireless"] = "true"
            }
        },

        ["firewall"] = new DeclarativeProfile
        {
            ProfileId = "firewall-standard",
            ProfileType = "firewall",
            PollIntervalSeconds = 300,
            Priority = 95,
            Queries = new ProfileQuery[]
            {
                new ProfileQuery { Operation = "get", Oids = new[] { "1.3.6.1.2.1.1.3.0" } },
                new ProfileQuery { Operation = "bulk_walk", RootOid = "1.3.6.1.2.1.2.2", MaxVariables = 100 }
            },
            Properties = new Dictionary<string, string>
            {
                ["supports_mib2"] = "true",
                ["supports_security"] = "true"
            }
        },

        ["ups"] = new DeclarativeProfile
        {
            ProfileId = "ups-standard",
            ProfileType = "ups",
            PollIntervalSeconds = 60,
            Priority = 100,
            Queries = new ProfileQuery[]
            {
                new ProfileQuery { Operation = "get", Oids = new[] { "1.3.6.1.2.1.1.3.0" } },
                new ProfileQuery { Operation = "walk", RootOid = "1.3.6.1.2.1.33" }
            },
            Properties = new Dictionary<string, string>
            {
                ["supports_ups"] = "true"
            }
        },

        ["printer"] = new DeclarativeProfile
        {
            ProfileId = "printer-standard",
            ProfileType = "printer",
            PollIntervalSeconds = 600,
            Priority = 50,
            Queries = new ProfileQuery[]
            {
                new ProfileQuery { Operation = "get", Oids = new[] { "1.3.6.1.2.1.1.3.0" } },
                new ProfileQuery { Operation = "walk", RootOid = "1.3.6.1.2.1.43" }
            },
            Properties = new Dictionary<string, string>
            {
                ["supports_printer"] = "true"
            }
        },

        ["network_device"] = Mib2NetworkBase
    };

    // Mapeamento de DeviceType -> ProfileId
    private static readonly Dictionary<string, string> TypeToProfileMapping = new()
    {
        ["switch"] = "switch-standard",
        ["router"] = "router-standard",
        ["access_point"] = "access-point-standard",
        ["firewall"] = "firewall-standard",
        ["ups"] = "ups-standard",
        ["printer"] = "printer-standard",
        ["network_device"] = "mib2-network-base",
        ["unknown_device"] = "mib2-network-base"
    };

    public Task<CollectionProfile?> ResolveProfileAsync(string deviceType, CancellationToken ct)
    {
        var profile = GetDeclarativeProfile(deviceType);
        if (profile == null)
            return Task.FromResult<CollectionProfile?>(null);

        // Convert declarative profile to entity profile
        var metricsJson = JsonSerializer.Serialize(profile.Queries.Select(q =>
            q.RootOid ?? (q.Oids?.FirstOrDefault() ?? "")));

        var profileEntity = CollectionProfile.Create(
            companyId: Guid.Empty, // Would be provided by context
            name: profile.ProfileId,
            description: $"Auto-generated profile for {deviceType}",
            profileType: profile.ProfileType,
            metrics: metricsJson,
            intervalSeconds: profile.PollIntervalSeconds,
            priority: profile.Priority,
            createdBy: Guid.Empty);

        return Task.FromResult<CollectionProfile?>(profileEntity);
    }

    public DeclarativeProfile? GetDeclarativeProfile(string deviceType)
    {
        if (TypeToProfileMapping.TryGetValue(deviceType.ToLowerInvariant(), out var profileId))
        {
            return ProfilesByType.GetValueOrDefault(profileId);
        }

        // Fallback to base MIB2 profile
        return Mib2NetworkBase;
    }

    /// <summary>
    ///     Retorna todos os perfis declarativos disponíveis.
    /// </summary>
    public IReadOnlyDictionary<string, DeclarativeProfile> GetAllProfiles() => ProfilesByType;
}
