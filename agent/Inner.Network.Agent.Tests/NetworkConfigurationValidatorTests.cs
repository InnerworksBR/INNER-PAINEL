using Inner.Network.Agent.Security;
using Inner.Network.Agent.Transport;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkConfigurationValidatorTests
{
    [Fact]
    public void Invalid_replacement_does_not_replace_last_valid_cached_configuration()
    {
        var secrets = new MemorySecretStore();
        var cache = new NetworkConfigurationCache(secrets);
        var valid = Config();
        cache.Replace(valid);
        var original = secrets.Read("configuration_cache");

        Assert.Throws<InvalidOperationException>(() => cache.Replace(valid with
        {
            Networks = [valid.Networks[0] with { Cidr = "010.0.0.0/24" }]
        }));

        Assert.Equal(original, secrets.Read("configuration_cache"));
    }

    [Theory]
    [InlineData("bad/24")]
    [InlineData("10.0.0.0/24")]
    public void Rejects_invalid_cidr_or_unresolvable_credential_reference(string cidr)
    {
        var config = Config() with
        {
            Networks = [Config().Networks[0] with
            {
                Cidr = cidr,
                CredentialIds = cidr == "10.0.0.0/24" ? ["missing"] : ["credential-1"]
            }]
        };

        Assert.Throws<InvalidOperationException>(() => NetworkConfigurationValidator.Validate(config));
    }

    [Fact]
    public void Rejects_out_of_range_exclusion_and_invalid_intervals()
    {
        var valid = Config();
        Assert.Throws<InvalidOperationException>(() => NetworkConfigurationValidator.Validate(valid with
        {
            Networks = [valid.Networks[0] with { ExcludedIps = ["10.0.1.1"] }]
        }));
        Assert.Throws<InvalidOperationException>(() => NetworkConfigurationValidator.Validate(valid with { DiscoveryIntervalSeconds = 59 }));
    }

    [Theory]
    [InlineData("network-1", "00000000-0000-4000-8000-000000000020")]
    [InlineData("00000000-0000-4000-8000-000000000010", "credential-1")]
    public void Rejects_non_uuid_network_and_credential_ids(string networkId, string credentialId)
    {
        var valid = Config();
        var invalid = valid with
        {
            Networks = [valid.Networks[0] with { Id = networkId, CredentialIds = [credentialId] }],
            Credentials = [valid.Credentials[0] with { Id = credentialId }]
        };

        Assert.Throws<InvalidOperationException>(() => NetworkConfigurationValidator.Validate(invalid));
    }

    [Theory]
    [InlineData("HTTP 401: Agente revogado ou não encontrado.", true)]
    [InlineData("HTTP 401: Token do agente inválido ou expirado.", false)]
    [InlineData("HTTP 403: Tipo de agente incompatível.", false)]
    public void Only_explicit_server_revocation_stops_cached_configuration(string message, bool expected)
    {
        var exception = new NetworkApiException(System.Net.HttpStatusCode.Unauthorized, message);

        Assert.Equal(expected, exception.ConfirmsAgentRevocation);
    }

    private static NetworkAgentConfiguration Config() => new(1, true, 60, 900,
        [new NetworkDefinition("00000000-0000-4000-8000-000000000010", "10.0.0.0/24", true, 161, [], ["00000000-0000-4000-8000-000000000020"], "00000000-0000-4000-8000-000000000001")],
        [new SnmpCredential("00000000-0000-4000-8000-000000000020", "readonly", "2c", Community: "community")]);

    private sealed class MemorySecretStore : INetworkSecretStore
    {
        private readonly Dictionary<string, string> _values = new();
        public void Save(string key, string value) => _values[key] = value;
        public string? Read(string key) => _values.GetValueOrDefault(key);
        public void Delete(string key) => _values.Remove(key);
    }
}
