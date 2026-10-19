using System.Net;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;
using Lextm.SharpSnmpLib.Security;

namespace Inner.Network.Agent.Snmp;

public sealed record SnmpValue(string Oid, string Value, SnmpType Type);

public sealed class SnmpClient
{
    public async Task<IReadOnlyList<SnmpValue>> GetAsync(IPEndPoint endpoint, Transport.SnmpCredential credential,
        IEnumerable<string> oids, TimeSpan timeout, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(endpoint);
        using var requestTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        requestTimeout.CancelAfter(timeout);
        var variables = oids.Select(oid => new Variable(new ObjectIdentifier(oid))).ToList();
        try
        {
            ISnmpMessage response;
            if (credential.Version == "2c")
            {
                if (string.IsNullOrWhiteSpace(credential.Community)) throw new ArgumentException("SNMP v2c credential has no community.");
                var request = new GetRequestMessage(Messenger.NextRequestId, VersionCode.V2, new OctetString(credential.Community), variables);
                response = await request.GetResponseAsync(endpoint, new UserRegistry(), requestTimeout.Token);
            }
            else if (credential.Version == "3")
            {
                response = await GetV3Async(endpoint, credential, variables, requestTimeout.Token);
            }
            else throw new ArgumentException("Only SNMP v2c and v3 credentials are supported.");

            var pdu = response.Pdu();
            if (pdu.TypeCode != SnmpType.ResponsePdu) throw new SnmpProtocolException($"SNMP returned {pdu.TypeCode}.");
            if (pdu.ErrorStatus.ToInt32() != 0) throw new SnmpProtocolException($"SNMP error status {pdu.ErrorStatus}.");
            return pdu.Variables
                .Where(v => v.Data.TypeCode is not (SnmpType.NoSuchObject or SnmpType.NoSuchInstance or SnmpType.EndOfMibView))
                .Select(v => new SnmpValue(v.Id.ToString(), v.Data.ToString(), v.Data.TypeCode)).ToArray();
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new SnmpTimeoutException(endpoint, timeout);
        }
        catch (Lextm.SharpSnmpLib.Messaging.TimeoutException)
        {
            throw new SnmpTimeoutException(endpoint, timeout);
        }
        catch (System.Net.Sockets.SocketException) when (!ct.IsCancellationRequested)
        {
            throw new SnmpTimeoutException(endpoint, timeout);
        }
    }

    public async Task<IReadOnlyList<SnmpValue>> WalkAsync(IPEndPoint endpoint, Transport.SnmpCredential credential,
        string rootOid, int maxRows, TimeSpan timeout, CancellationToken ct = default)
    {
        using var requestTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        requestTimeout.CancelAfter(timeout);
        var token = requestTimeout.Token;
        try
        {
            var rows = new List<SnmpValue>();
            var current = new ObjectIdentifier(rootOid);
            ISnmpMessage? v3Report = null;
            IPrivacyProvider? privacy = null;
            UserRegistry? registry = null;
            if (credential.Version == "3")
            {
                (privacy, registry) = CreateV3Security(credential);
                v3Report = await Messenger.GetNextDiscovery(SnmpType.GetRequestPdu).GetResponseAsync(endpoint, token);
            }
            while (rows.Count < Math.Clamp(maxRows, 1, 256))
            {
                ISnmpMessage response;
                if (credential.Version == "2c")
                {
                    var request = new GetNextRequestMessage(Messenger.NextRequestId, VersionCode.V2,
                        new OctetString(credential.Community ?? throw new ArgumentException("SNMP v2c credential has no community.")),
                        [new Variable(current)]);
                    response = await request.GetResponseAsync(endpoint, new UserRegistry(), token);
                }
                else
                {
                    var request = new GetNextRequestMessage(VersionCode.V3, Messenger.NextMessageId, Messenger.NextRequestId,
                        new OctetString(credential.Username!), new OctetString(credential.ContextName ?? string.Empty),
                        [new Variable(current)], privacy!, Messenger.MaxMessageSize, v3Report!);
                    response = await request.GetResponseAsync(endpoint, registry!, token);
                }
                var pdu = response.Pdu();
                if (pdu.TypeCode == SnmpType.ReportPdu)
                    throw new SnmpAuthenticationException("SNMP v3 security report during table walk.");
                if (pdu.TypeCode != SnmpType.ResponsePdu || pdu.ErrorStatus.ToInt32() != 0) break;
                var next = pdu.Variables.FirstOrDefault();
                if (next is null || !next.Id.ToString().StartsWith(rootOid + ".", StringComparison.Ordinal) || next.Data.TypeCode == SnmpType.EndOfMibView ||
                    next.Data.TypeCode is SnmpType.NoSuchObject or SnmpType.NoSuchInstance) break;
                rows.Add(new(next.Id.ToString(), next.Data.ToString(), next.Data.TypeCode));
                current = next.Id;
            }
            return rows;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new SnmpTimeoutException(endpoint, timeout); }
        catch (Lextm.SharpSnmpLib.Messaging.TimeoutException) { throw new SnmpTimeoutException(endpoint, timeout); }
        catch (System.Net.Sockets.SocketException) when (!ct.IsCancellationRequested) { throw new SnmpTimeoutException(endpoint, timeout); }
    }

    private static async Task<ISnmpMessage> GetV3Async(IPEndPoint endpoint, Transport.SnmpCredential credential, List<Variable> variables, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(credential.Username) || string.IsNullOrWhiteSpace(credential.AuthPassword))
            throw new ArgumentException("SNMP v3 authentication credential is incomplete.");
        var (privacy, registry) = CreateV3Security(credential);
        var discovery = Messenger.GetNextDiscovery(SnmpType.GetRequestPdu);
        var report = await discovery.GetResponseAsync(endpoint, ct);
        var request = new GetRequestMessage(VersionCode.V3, Messenger.NextMessageId, Messenger.NextRequestId,
            new OctetString(credential.Username), new OctetString(credential.ContextName ?? string.Empty), variables,
            privacy, Messenger.MaxMessageSize, report);
        var response = await request.GetResponseAsync(endpoint, registry, ct);
        if (response.TypeCode() == SnmpType.ReportPdu)
        {
            var reportOid = response.Pdu().Variables.FirstOrDefault()?.Id.ToString();
            throw new SnmpAuthenticationException($"SNMP v3 security report {reportOid ?? "unknown"}.");
        }
        return response;
    }

    private static (IPrivacyProvider Privacy, UserRegistry Registry) CreateV3Security(Transport.SnmpCredential credential)
    {
        if (string.IsNullOrWhiteSpace(credential.Username) || string.IsNullOrWhiteSpace(credential.AuthPassword))
            throw new ArgumentException("SNMP v3 authentication credential is incomplete.");
        var auth = credential.AuthProtocol switch
        {
#pragma warning disable CS0618 // SHA1AuthenticationProvider is required for approved legacy SNMPv3 devices.
            "SHA1" => (IAuthenticationProvider)new SHA1AuthenticationProvider(new OctetString(credential.AuthPassword)),
#pragma warning restore CS0618
            "SHA256" => new SHA256AuthenticationProvider(new OctetString(credential.AuthPassword)),
            _ => throw new ArgumentException("SNMP v3 requires SHA1 or SHA256 authentication.")
        };
        IPrivacyProvider privacy = credential.SecurityLevel == "authPriv"
            ? credential.PrivacyProtocol == "AES128" && !string.IsNullOrWhiteSpace(credential.PrivacyPassword)
                ? new AESPrivacyProvider(new OctetString(credential.PrivacyPassword), auth)
                : throw new ArgumentException("SNMP v3 authPriv requires an AES128 privacy password.")
            : credential.SecurityLevel == "authNoPriv"
                ? new DefaultPrivacyProvider(auth)
                : throw new ArgumentException("SNMP v3 security level must be authNoPriv or authPriv.");
        var registry = new UserRegistry();
        registry.Add(new User(new OctetString(credential.Username), privacy));
        return (privacy, registry);
    }
}

public sealed class SnmpTimeoutException(IPEndPoint endpoint, TimeSpan timeout) : System.TimeoutException($"SNMP request to {endpoint} exceeded {timeout.TotalMilliseconds:0} ms.");
public sealed class SnmpAuthenticationException(string message) : Exception(message);
public sealed class SnmpProtocolException(string message) : Exception(message);
