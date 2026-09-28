using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using Inner.Agent.Windows.Contracts;

namespace Inner.Agent.Windows.Collectors;

[SupportedOSPlatform("windows")]
public sealed class WindowsHostMetricsCollector : IHostMetricsCollector
{
    private CpuSample? _previousCpu;

    public Task<HostMetrics> CollectAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.Run(Collect, cancellationToken);
    }

    private HostMetrics Collect()
    {
        var memory = ReadMemory();
        var cpu = ReadCpuPercent();
        var disk = ReadSystemDiskPercent();

        return new HostMetrics(
            Environment.MachineName,
            cpu,
            memory.TotalBytes == 0 ? 0 : memory.UsedBytes * 100d / memory.TotalBytes,
            memory.TotalBytes / 1024d / 1024d,
            memory.UsedBytes / 1024d / 1024d,
            disk,
            Environment.TickCount64 / 1000);
    }

    private double ReadCpuPercent()
    {
        if (!GetSystemTimes(out var idle, out var kernel, out var user)) return 0;

        var current = new CpuSample(ToUInt64(idle), ToUInt64(kernel), ToUInt64(user));
        var previous = Interlocked.Exchange(ref _previousCpu, current);
        if (previous is null) return 0;

        var idleDelta = current.Idle - previous.Idle;
        var totalDelta = (current.Kernel - previous.Kernel) + (current.User - previous.User);
        var busyDelta = Math.Max(0, totalDelta - idleDelta);
        return totalDelta <= 0 ? 0 : Math.Clamp(busyDelta * 100d / totalDelta, 0, 100);
    }

    private static MemorySample ReadMemory()
    {
        var status = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        if (!GlobalMemoryStatusEx(ref status)) return new MemorySample(0, 0);
        return new MemorySample(status.TotalPhysical, status.TotalPhysical - status.AvailablePhysical);
    }

    private static double ReadSystemDiskPercent()
    {
        try
        {
            var root = Path.GetPathRoot(Environment.SystemDirectory);
            if (string.IsNullOrWhiteSpace(root)) return 0;
            var drive = new DriveInfo(root);
            return drive.TotalSize <= 0 ? 0 : Math.Clamp((drive.TotalSize - drive.AvailableFreeSpace) * 100d / drive.TotalSize, 0, 100);
        }
        catch
        {
            return 0;
        }
    }

    private static ulong ToUInt64(FileTime value) => ((ulong)value.High << 32) | value.Low;

    private sealed record CpuSample(ulong Idle, ulong Kernel, ulong User);
    private readonly record struct MemorySample(ulong TotalBytes, ulong UsedBytes);

    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime
    {
        public uint Low;
        public uint High;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatus
    {
        public uint Length;
        public uint MemoryLoad;
        public ulong TotalPhysical;
        public ulong AvailablePhysical;
        public ulong TotalPageFile;
        public ulong AvailablePageFile;
        public ulong TotalVirtual;
        public ulong AvailableVirtual;
        public ulong AvailableExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetSystemTimes(out FileTime idleTime, out FileTime kernelTime, out FileTime userTime);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);
}
