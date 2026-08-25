namespace Inner.Monitoring.Edge.Collector.Snmp;

/// <summary>
///     Constantes e definições de OIDs MIB-II.
/// </summary>
public static class Mib2Oids
{
    // MIB-II System Group (1.3.6.1.2.1.1)
    public static class System
    {
        /// <summary>sysDescr - Descrição do sistema</summary>
        public const string Descr = "1.3.6.1.2.1.1.1.0";

        /// <summary>sysObjectID - Identificador do objeto (fabricante)</summary>
        public const string ObjectId = "1.3.6.1.2.1.1.2.0";

        /// <summary>sysUpTime - Tempo desde a última reinicialização</summary>
        public const string UpTime = "1.3.6.1.2.1.1.3.0";

        /// <summary>sysContact - Contato do administrador</summary>
        public const string Contact = "1.3.6.1.2.1.1.4.0";

        /// <summary>sysName - Nome do sistema</summary>
        public const string Name = "1.3.6.1.2.1.1.5.0";

        /// <summary>sysLocation - Localização física</summary>
        public const string Location = "1.3.6.1.2.1.1.6.0";

        /// <summary>sysServices - Nível de serviço</summary>
        public const string Services = "1.3.6.1.2.1.1.7.0";

        // Array para queries de identity probe
        public static readonly string[] IdentityProbe = [Descr, ObjectId, UpTime, Name, Location];
    }

    // MIB-II Interfaces Group (1.3.6.1.2.1.2)
    public static class Interfaces
    {
        /// <summary>ifNumber - Número de interfaces</summary>
        public const string Number = "1.3.6.1.2.1.2.1.0";

        // Tabela de interfaces - índice base
        public const string Table = "1.3.6.1.2.1.2.2";

        /// <summary>ifIndex</summary>
        public const string Index = "1.3.6.1.2.1.2.2.1.1";

        /// <summary>ifDescr - Descrição da interface</summary>
        public const string Descr = "1.3.6.1.2.1.2.2.1.2";

        /// <summary>ifType - Tipo da interface (ethernet, etc)</summary>
        public const string Type = "1.3.6.1.2.1.2.2.1.3";

        /// <summary>ifSpeed - Velocidade em bits por segundo</summary>
        public const string Speed = "1.3.6.1.2.1.2.2.1.5";

        /// <summary>ifPhysAddress - Endereço MAC</summary>
        public const string PhysAddress = "1.3.6.1.2.1.2.2.1.6";

        /// <summary>ifAdminStatus - Status administrativo</summary>
        public const string AdminStatus = "1.3.6.1.2.1.2.2.1.7";

        /// <summary>ifOperStatus - Status operacional</summary>
        public const string OperStatus = "1.3.6.1.2.1.2.2.1.8";

        /// <summary>ifInOctets - Bytes de entrada</summary>
        public const string InOctets = "1.3.6.1.2.1.2.2.1.10";

        /// <summary>ifOutOctets - Bytes de saída</summary>
        public const string OutOctets = "1.3.6.1.2.1.2.2.1.16";

        /// <summary>ifInErrors - Erros de entrada</summary>
        public const string InErrors = "1.3.6.1.2.1.2.2.1.14";

        /// <summary>ifOutErrors - Erros de saída</summary>
        public const string OutErrors = "1.3.6.1.2.1.2.2.1.20";

        /// <summary>ifInDiscards - Pacotes descartados de entrada</summary>
        public const string InDiscards = "1.3.6.1.2.1.2.2.1.13";

        /// <summary>ifOutDiscards - Pacotes descartados de saída</summary>
        public const string OutDiscards = "1.3.6.1.2.1.2.2.1.19";
    }

    // IP Group (1.3.6.1.2.1.4)
    public static class Ip
    {
        /// <summary>ipForwarding - IP Forwarding</summary>
        public const string Forwarding = "1.3.6.1.2.1.4.1.0";

        /// <summary>ipDefaultTTL - TTL padrão</summary>
        public const string DefaultTtl = "1.3.6.1.2.1.4.2.0";

        /// <summary>ipAdEntAddr - Endereço IP da tabela de endereços</summary>
        public const string AdEntAddr = "1.3.6.1.2.1.4.20.1.1";

        /// <summary>ipAdEntIfIndex - Índice da interface</summary>
        public const string AdEntIfIndex = "1.3.6.1.2.1.4.20.1.2";

        /// <summary>ipAdEntNetMask - Máscara de rede</summary>
        public const string AdEntNetMask = "1.3.6.1.2.1.4.20.1.3";
    }

    // TCP Group (1.3.6.1.2.1.6)
    public static class Tcp
    {
        /// <summary>tcpRtoAlgorithm - Algoritmo de retransmissão</summary>
        public const string RtoAlgorithm = "1.3.6.1.2.1.6.1.0";

        /// <summary>tcpCurrEstab - Conexões estabelecidas</summary>
        public const string CurrEstab = "1.3.6.1.2.1.6.9.0";
    }

    // UDP Group (1.3.6.1.2.1.7)
    public static class Udp
    {
        /// <summary>udpInDatagrams - Datagramas UDP recebidos</summary>
        public const string InDatagrams = "1.3.6.1.2.1.7.1.0";

        /// <summary>udpNoPorts - Portas sem receptor</summary>
        public const string NoPorts = "1.3.6.1.2.1.7.2.0";
    }

    // SNMP MIB (1.3.6.1.2.1.11)
    public static class SnmpMib
    {
        /// <summary>snmpInPkts - Pacotes SNMP recebidos</summary>
        public const string InPkts = "1.3.6.1.2.1.11.1.0";

        /// <summary>snmpOutPkts - Pacotes SNMP enviados</summary>
        public const string OutPkts = "1.3.6.1.2.1.11.2.0";

        /// <summary>snmpInBadVersions - Versões inválidas</summary>
        public const string InBadVersions = "1.3.6.1.2.1.11.3.0";

        /// <summary>snmpInBadCommunityNames - Comunidades inválidas</summary>
        public const string InBadCommunityNames = "1.3.6.1.2.1.11.4.0";

        /// <summary>snmpInASNParseErrs - Erros de parse</summary>
        public const string InAsnParseErrs = "1.3.6.1.2.1.11.5.0";
    }

    // IF-MIB - Extended Interface Info
    public static class IfMib
    {
        /// <summary>ifAlias - Alias da interface (VLAN name)</summary>
        public const string Alias = "1.3.6.1.2.1.31.1.1.1.18";

        /// <summary>ifHighSpeed - Velocidade alta (Mbps)</summary>
        public const string HighSpeed = "1.3.6.1.2.1.31.1.1.1.15";
    }

    // EtherLike-MIB
    public static class EtherLike
    {
        /// <summary>dot3StatsIndex</summary>
        public const string StatsIndex = "1.3.6.1.2.1.10.7.2.1.1";

        /// <summary>dot3StatsAlignmentErrors</summary>
        public const string AlignmentErrors = "1.3.6.1.2.1.10.7.2.1.2";

        /// <summary>dot3StatsFCSErrors</summary>
        public const string FcsErrors = "1.3.6.1.2.1.10.7.2.1.4";
    }

    // RFC1213-MIB3 - Entity MIB (for chassis info)
    public static class Entity
    {
        /// <summary>entPhysicalEntry</summary>
        public const string PhysicalTable = "1.3.6.1.2.1.47.1.1.1";

        /// <summary>entPhysicalDescr</summary>
        public const string PhysicalDescr = "1.3.6.1.2.1.47.1.1.1.1.2";

        /// <summary>entPhysicalVendorType</summary>
        public const string VendorType = "1.3.6.1.2.1.47.1.1.1.1.3";

        /// <summary>entPhysicalSerialNum</summary>
        public const string SerialNum = "1.3.6.1.2.1.47.1.1.1.1.11";

        /// <summary>entPhysicalModelName</summary>
        public const string ModelName = "1.3.6.1.2.1.47.1.1.1.1.12";
    }
}

/// <summary>
///     Tipos comuns de interfaces según RFC 1573/2233
/// </summary>
public static class InterfaceTypes
{
    public const int Other = 1;
    public const int Regular1822 = 2;
    public const int Hdlc = 3;
    public const int Unspecified = 4;
    public const int Slip = 5;
    public const int Ppp = 9;
    public const int Loopback = 24;
    public const int EtherCsmacd = 6;
    public const int Iso88025Copr = 27;
    public const int PopTerminal = 28;
    public const int Async = 12;
    public const int Pnni = 89;
    public const int Atm = 37;
    public const int MpoaOverAtm = 63;
    public const int Aal5 = 49;
    public const int Fiberchannel = 56;
    public const int Mcast8023 = 57;
    public const int InfiniBand = 199;
    public const int Tunnel = 131;
    public const int Vlan = 135;
}
