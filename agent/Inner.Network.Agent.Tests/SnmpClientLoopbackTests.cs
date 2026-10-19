using System.Net;
using Inner.Network.Agent.Snmp;
using Inner.Network.Agent.Transport;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Security;
using Samples.Pipeline;
using Xunit;
using Listener = Samples.Pipeline.Listener;

namespace Inner.Network.Agent.Tests;

public sealed class SnmpClientLoopbackTests
{
    private const string SysDescr = "1.3.6.1.2.1.1.1.0";

    [Fact]
    public async Task V2c_get_reads_a_real_response_from_loopback_udp_simulator()
    {
        using var simulator = new LoopbackSnmpSimulator(version3: false);
        simulator.Start();
        var result = await new SnmpClient().GetAsync(simulator.Endpoint,
            new SnmpCredential("credential", "read", "2c", Community: "community"), [SysDescr], TimeSpan.FromSeconds(2));

        Assert.Equal("loopback-snmp-device", Assert.Single(result).Value);
    }

    [Theory]
    [InlineData("SHA1")]
    [InlineData("SHA256")]
    public async Task V3_authNoPriv_get_reads_a_real_response_from_loopback_udp_simulator(string authProtocol)
    {
        using var simulator = new LoopbackSnmpSimulator(version3: true, authPriv: false, authProtocol);
        simulator.Start();
        var result = await new SnmpClient().GetAsync(simulator.Endpoint,
            new SnmpCredential("credential", "read", "3", Username: "snmp-user", SecurityLevel: "authNoPriv", AuthProtocol: authProtocol, AuthPassword: "auth-pass-123"),
            [SysDescr], TimeSpan.FromSeconds(2));

        Assert.Equal("loopback-snmp-device", Assert.Single(result).Value);
    }

    [Theory]
    [InlineData("SHA1")]
    [InlineData("SHA256")]
    public async Task V3_authPriv_aes128_get_reads_a_real_response_from_loopback_udp_simulator(string authProtocol)
    {
        using var simulator = new LoopbackSnmpSimulator(version3: true, authPriv: true, authProtocol);
        simulator.Start();
        var result = await new SnmpClient().GetAsync(simulator.Endpoint,
            new SnmpCredential("credential", "read", "3", Username: "snmp-user", SecurityLevel: "authPriv", AuthProtocol: authProtocol, AuthPassword: "auth-pass-123", PrivacyProtocol: "AES128", PrivacyPassword: "privacy-pass-123"),
            [SysDescr], TimeSpan.FromSeconds(2));

        Assert.Equal("loopback-snmp-device", Assert.Single(result).Value);
    }

    [Fact]
    public async Task Missing_loopback_responder_returns_bounded_timeout_without_inventing_values()
    {
        var socket = new System.Net.Sockets.UdpClient(new IPEndPoint(IPAddress.Loopback, 0));
        var endpoint = (IPEndPoint)socket.Client.LocalEndPoint!;
        socket.Dispose();
        var timer = System.Diagnostics.Stopwatch.StartNew();

        await Assert.ThrowsAsync<SnmpTimeoutException>(() => new SnmpClient().GetAsync(endpoint,
            new SnmpCredential("credential", "read", "2c", Community: "community"), [SysDescr], TimeSpan.FromMilliseconds(150)));

        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(2));
    }

    private sealed class LoopbackSnmpSimulator(bool version3, bool authPriv = false, string authProtocol = "SHA256") : IDisposable
    {
        private readonly byte[] _engineId = [0x80, 0x00, 0x4f, 0xb8, 0x05, 0x06, 0x01, 0x02];
        private readonly int _port = GetFreePort();
        private SnmpEngine? _engine;
        public IPEndPoint Endpoint => new(IPAddress.Loopback, _port);

        public void Start()
        {
            var users = new UserRegistry();
            if (version3)
            {
                IAuthenticationProvider authentication = authProtocol == "SHA1"
                    ? new SHA1AuthenticationProvider(new OctetString("auth-pass-123"))
                    : new SHA256AuthenticationProvider(new OctetString("auth-pass-123"));
                IPrivacyProvider privacy = authPriv
                    ? new AESPrivacyProvider(new OctetString("privacy-pass-123"), authentication)
                    : new DefaultPrivacyProvider(authentication);
                users.Add(new OctetString("snmp-user"), privacy);
            }
            var listener = new Listener { Users = users };
            var store = new ObjectStore();
            store.Add(new StringObject(SysDescr, "loopback-snmp-device"));
            store.Add(new StringObject("1.3.6.1.2.1.1.5.0", "loopback-device"));
            var members = version3
                ? new ComposedMembershipProvider([new Version3MembershipProvider()])
                : new ComposedMembershipProvider([new Version2MembershipProvider(new OctetString("community"), new OctetString("community"))]);
            _engine = new SnmpEngine(listener, new EngineGroup(_engineId), store, members);
            listener.AddBinding(Endpoint);
            _engine.Start();
        }

        public void Dispose()
        {
            if (_engine is null) return;
            _engine.Stop();
            _engine.Dispose();
        }

        private static int GetFreePort()
        {
            using var udp = new System.Net.Sockets.UdpClient(new IPEndPoint(IPAddress.Loopback, 0));
            return ((IPEndPoint)udp.Client.LocalEndPoint!).Port;
        }

        private sealed class StringObject(string oid, string value) : ScalarObject(oid)
        {
            public override ISnmpData Data { get; set; } = new OctetString(value);
        }
    }
}
