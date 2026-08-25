using System.Collections.Immutable;
using Inner.Monitoring.Contracts.Records;
using System.Runtime.InteropServices;

namespace Inner.Monitoring.Agent.Windows.Collectors;

/// <summary>
///     Coleta métricas de disco (volumes montados).
/// </summary>
public sealed class DiskCollector : IObservationCollector
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct DRIVE_INFO
    {
        public uint dwVolumeSerialNumber;
        public uint dwMaximumComponentLength;
        public uint dwFileSystemFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 261)]
        public string lpVolumeName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 261)]
        public string lpFileSystemName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 261)]
        public string lpRootPathName;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LARGE_INTEGER
    {
        public long QuadPart;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetDiskFreeSpaceEx(
        string lpDirectoryName,
        out LARGE_INTEGER lpFreeBytesAvailable,
        out LARGE_INTEGER lpTotalNumberOfBytes,
        out LARGE_INTEGER lpTotalNumberOfFreeBytes);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern uint GetLogicalDrives();

    public string Name => "disk";
    public int Priority => 30;

    public Task<CollectionResult> CollectAsync(CollectionContext context, CancellationToken ct)
    {
        var records = new List<BatchRecord>();

        try
        {
            var drives = GetAvailableDrives();

            foreach (var drive in drives)
            {
                ct.ThrowIfCancellationRequested();

                if (!GetDiskFreeSpaceEx(drive, out var freeBytes, out var totalBytes, out var totalFreeBytes))
                {
                    continue;
                }

                var total = totalBytes.QuadPart;
                var free = freeBytes.QuadPart;
                var used = total - free;
                var usagePercent = total > 0 ? (used / (double)total) * 100.0 : 0.0;

                // Volume label
                var volumeName = GetVolumeName(drive);

                // Drive letter (C:, D:, etc.)
                var driveLetter = drive.TrimEnd('\\');

                var dimensions = ImmutableDictionary<string, string>.Empty
                    .Add("volume", volumeName)
                    .Add("mount", drive);

                // Total space
                records.Add(new BatchRecord(
                    RecordType: "metric",
                    RecordId: Guid.NewGuid(),
                    ObservedAt: context.CollectedAt,
                    LocalAssetId: $"{context.LocalAssetId}_{driveLetter.Replace(":", "").ToLowerInvariant()}",
                    AssetType: "disk",
                    DisplayName: $"Disk {driveLetter}",
                    Identifiers: null,
                    Properties: new Dictionary<string, string>
                    {
                        ["mount_point"] = drive,
                        ["volume_label"] = volumeName,
                        ["file_system"] = GetFileSystem(drive)
                    }.ToImmutableDictionary(),
                    Capabilities: null,
                    MetricKey: "host.disk.total_bytes",
                    ValueType: "long",
                    ValueDouble: null,
                    ValueLong: total,
                    ValueBoolean: null,
                    ValueString: null,
                    Unit: "bytes",
                    Quality: "good",
                    Dimensions: dimensions,
                    Protocol: null,
                    Result: null,
                    StartedAt: null,
                    FinishedAt: null,
                    DurationMs: null,
                    RetryCount: null,
                    ErrorCode: null,
                    Details: null,
                    EventType: null,
                    Severity: null,
                    Message: null,
                    Data: null));

                // Free space
                records.Add(new BatchRecord(
                    RecordType: "metric",
                    RecordId: Guid.NewGuid(),
                    ObservedAt: context.CollectedAt,
                    LocalAssetId: $"{context.LocalAssetId}_{driveLetter.Replace(":", "").ToLowerInvariant()}",
                    AssetType: "disk",
                    DisplayName: $"Disk {driveLetter} Free",
                    Identifiers: null,
                    Properties: null,
                    Capabilities: null,
                    MetricKey: "host.disk.free_bytes",
                    ValueType: "long",
                    ValueDouble: null,
                    ValueLong: free,
                    ValueBoolean: null,
                    ValueString: null,
                    Unit: "bytes",
                    Quality: "good",
                    Dimensions: dimensions,
                    Protocol: null,
                    Result: null,
                    StartedAt: null,
                    FinishedAt: null,
                    DurationMs: null,
                    RetryCount: null,
                    ErrorCode: null,
                    Details: null,
                    EventType: null,
                    Severity: null,
                    Message: null,
                    Data: null));

                // Usage percent
                records.Add(new BatchRecord(
                    RecordType: "metric",
                    RecordId: Guid.NewGuid(),
                    ObservedAt: context.CollectedAt,
                    LocalAssetId: $"{context.LocalAssetId}_{driveLetter.Replace(":", "").ToLowerInvariant()}",
                    AssetType: "disk",
                    DisplayName: $"Disk {driveLetter} Usage",
                    Identifiers: null,
                    Properties: null,
                    Capabilities: null,
                    MetricKey: "host.disk.usage_percent",
                    ValueType: "double",
                    ValueDouble: Math.Round(usagePercent, 2),
                    ValueLong: null,
                    ValueBoolean: null,
                    ValueString: null,
                    Unit: "percent",
                    Quality: usagePercent > 90 ? "questionable" : "good",
                    Dimensions: dimensions,
                    Protocol: null,
                    Result: null,
                    StartedAt: null,
                    FinishedAt: null,
                    DurationMs: null,
                    RetryCount: null,
                    ErrorCode: null,
                    Details: null,
                    EventType: null,
                    Severity: null,
                    Message: null,
                    Data: null));
            }

            return Task.FromResult(new CollectionResult { Records = records });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new CollectionResult
            {
                Records = records,
                Success = false,
                ErrorCode = "DISK_COLLECT_EXCEPTION",
                ErrorMessage = ex.Message
            });
        }
    }

    private static List<string> GetAvailableDrives()
    {
        var drives = new List<string>();
        var logicalDrives = GetLogicalDrives();

        for (var i = 0; i < 26; i++)
        {
            if ((logicalDrives & (1u << i)) != 0)
            {
                var driveLetter = $"{(char)('A' + i)}:\\";
                // Only include fixed and removable drives
                var driveType = GetDriveType(driveLetter);
                if (driveType == DriveType.Fixed || driveType == DriveType.Removable)
                {
                    drives.Add(driveLetter);
                }
            }
        }

        return drives;
    }

    private static string GetVolumeName(string drive)
    {
        try
        {
            var volumeName = new string('\0', 261);
            var fileSystemName = new string('\0', 261);
            GetVolumeInformation(
                drive,
                volumeName,
                volumeName.Length,
                out _,
                out _,
                out _,
                fileSystemName,
                fileSystemName.Length);
            return volumeName.TrimEnd('\0') ?? drive;
        }
        catch
        {
            return drive;
        }
    }

    private static string GetFileSystem(string drive)
    {
        try
        {
            var volumeName = new string('\0', 261);
            var fileSystemName = new string('\0', 261);
            GetVolumeInformation(
                drive,
                volumeName,
                volumeName.Length,
                out _,
                out _,
                out _,
                fileSystemName,
                fileSystemName.Length);
            return fileSystemName.TrimEnd('\0') ?? "Unknown";
        }
        catch
        {
            return "Unknown";
        }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetVolumeInformation(
        string lpRootPathName,
        string lpVolumeNameBuffer,
        int nVolumeNameSize,
        out uint lpVolumeSerialNumber,
        out uint lpMaximumComponentLength,
        out uint lpFileSystemFlags,
        string lpFileSystemNameBuffer,
        int nFileSystemNameSize);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern DriveType GetDriveType(string lpRootPathName);

    private enum DriveType : uint
    {
        Unknown = 0,
        Invalid = 1,
        Removable = 2,
        Fixed = 3,
        Network = 4,
        CDRom = 5,
        RamDisk = 6
    }
}
