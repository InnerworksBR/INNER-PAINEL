using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Domain.Entities;
using Xunit;

namespace Inner.Monitoring.Domain.Tests;

public class SourceTests
{
    [Fact]
    public void Create_ShouldSetInitialState()
    {
        // Arrange
        var companyId = Guid.NewGuid();
        var siteId = Guid.NewGuid();
        var installationId = Guid.NewGuid();

        // Act
        var source = Source.Create(
            companyId,
            siteId,
            SourceType.Agent,
            installationId,
            "Test Agent",
            "windows",
            "x64",
            "1.0.0",
            60);

        // Assert
        Assert.NotEqual(Guid.Empty, source.Id);
        Assert.Equal(companyId, source.CompanyId);
        Assert.Equal(siteId, source.SiteId);
        Assert.Equal(SourceType.Agent, source.SourceType);
        Assert.Equal("Test Agent", source.DisplayName);
        Assert.Equal("windows", source.Platform);
        Assert.Equal(SourceStatus.Online, source.Status);
        Assert.Equal("1.0.0", source.CurrentVersion);
    }

    [Fact]
    public void RecordHeartbeat_ShouldUpdateLastHeartbeatAndIp()
    {
        // Arrange
        var source = Source.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            SourceType.Agent,
            Guid.NewGuid(),
            "Test Agent",
            "windows",
            "x64",
            "1.0.0",
            60);

        var now = DateTimeOffset.UtcNow;
        var ip = "192.168.1.100";

        // Act
        source.RecordHeartbeat(now, ip);

        // Assert
        Assert.NotNull(source.LastHeartbeatAt);
        Assert.Equal(ip, source.LastIp);
        Assert.NotNull(source.ClockSkewSeconds);
    }

    [Fact]
    public void Revoke_ShouldSetRevokedAtAndStatus()
    {
        // Arrange
        var source = Source.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            SourceType.Agent,
            Guid.NewGuid(),
            "Test Agent",
            "windows",
            "x64",
            "1.0.0",
            60);

        // Act
        source.Revoke();

        // Assert
        Assert.NotNull(source.RevokedAt);
        Assert.Equal(SourceStatus.Revoked, source.Status);
    }
}

public class IngestBatchTests
{
    [Fact]
    public void Create_ShouldSetInitialState()
    {
        // Arrange
        var companyId = Guid.NewGuid();
        var sourceId = Guid.NewGuid();
        var batchId = Guid.NewGuid();
        var contentSha256 = new byte[32];

        // Act
        var batch = IngestBatch.Create(
            companyId,
            sourceId,
            batchId,
            1,
            1,
            "1.0.0",
            contentSha256,
            10,
            1024,
            2048,
            DateTimeOffset.UtcNow.AddMinutes(-1),
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow,
            System.Text.Json.JsonDocument.Parse("{}"));

        // Assert
        Assert.NotEqual(Guid.Empty, batch.Id);
        Assert.Equal(companyId, batch.CompanyId);
        Assert.Equal(sourceId, batch.SourceId);
        Assert.Equal(batchId, batch.BatchId);
        Assert.Equal(1, batch.Sequence);
    }

    [Fact]
    public void MarkProcessed_ShouldSetStatusAndProcessedAt()
    {
        // Arrange
        var batch = CreateTestBatch();

        // Act
        batch.MarkProcessed();

        // Assert
        Assert.Equal(BatchStatus.Processed, batch.Status);
        Assert.NotNull(batch.ProcessedAt);
    }

    [Fact]
    public void MarkDeadLetter_ShouldSetStatusAndError()
    {
        // Arrange
        var batch = CreateTestBatch();

        // Act
        batch.MarkDeadLetter("validation_error", "Invalid payload");

        // Assert
        Assert.Equal(BatchStatus.DeadLetter, batch.Status);
        Assert.Equal("validation_error", batch.LastErrorCode);
        Assert.Equal("Invalid payload", batch.LastErrorDetail);
    }

    private static IngestBatch CreateTestBatch()
    {
        return IngestBatch.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            1,
            1,
            "1.0.0",
            new byte[32],
            10,
            1024,
            2048,
            DateTimeOffset.UtcNow.AddMinutes(-1),
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow,
            System.Text.Json.JsonDocument.Parse("{}"));
    }
}

public class ProcessingJobTests
{
    [Fact]
    public void Create_ShouldSetInitialState()
    {
        // Arrange
        var batchId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var sourceId = Guid.NewGuid();

        // Act
        var job = ProcessingJob.Create(batchId, companyId, sourceId);

        // Assert
        Assert.NotEqual(Guid.Empty, job.Id);
        Assert.Equal(batchId, job.BatchRowId);
        Assert.Equal(companyId, job.CompanyId);
        Assert.Equal(sourceId, job.SourceId);
        Assert.Equal(0, job.Attempts);
        Assert.Equal(10, job.MaxAttempts);
    }

    [Fact]
    public void TryAcquire_ShouldAcquireLease_WhenPending()
    {
        // Arrange
        var job = ProcessingJob.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        // Act
        var acquired = job.TryAcquire("worker-1", TimeSpan.FromMinutes(5));

        // Assert
        Assert.True(acquired);
        Assert.Equal("worker-1", job.LeasedBy);
        Assert.NotNull(job.LeaseExpiresAt);
    }

    [Fact]
    public void TryAcquire_ShouldNotAcquireLease_WhenAlreadyLeased()
    {
        // Arrange
        var job = ProcessingJob.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        job.TryAcquire("worker-1", TimeSpan.FromMinutes(5));

        // Act
        var acquired = job.TryAcquire("worker-2", TimeSpan.FromMinutes(5));

        // Assert
        Assert.False(acquired);
    }

    [Fact]
    public void MarkCompleted_ShouldSetStatusAndCompletedAt()
    {
        // Arrange
        var job = ProcessingJob.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        job.TryAcquire("worker-1", TimeSpan.FromMinutes(5));

        // Act
        job.MarkCompleted();

        // Assert
        Assert.Equal(JobStatus.Completed, job.Status);
        Assert.NotNull(job.CompletedAt);
        Assert.Null(job.LeaseExpiresAt);
    }

    [Fact]
    public void MarkRetrying_ShouldIncrementAttemptsAndSetBackoff()
    {
        // Arrange
        var job = ProcessingJob.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        // Act
        job.MarkRetrying("processing_error", "Failed");

        // Assert
        Assert.Equal(1, job.Attempts);
        Assert.Equal(JobStatus.Retrying, job.Status);
        Assert.True(job.AvailableAt > DateTimeOffset.UtcNow);
    }
}

public class AssetTests
{
    [Fact]
    public void Create_ShouldSetInitialState()
    {
        // Arrange
        var companyId = Guid.NewGuid();
        var siteId = Guid.NewGuid();

        // Act
        var asset = Asset.Create(companyId, siteId, "windows_host", "Test Server");

        // Assert
        Assert.NotEqual(Guid.Empty, asset.Id);
        Assert.Equal(companyId, asset.CompanyId);
        Assert.Equal(siteId, asset.SiteId);
        Assert.Equal("windows_host", asset.AssetType);
        Assert.Equal("Test Server", asset.DisplayName);
        Assert.Equal("active", asset.LifecycleStatus);
    }

    [Fact]
    public void MarkDeleted_ShouldSetDeletedAtAndStatus()
    {
        // Arrange
        var asset = Asset.Create(Guid.NewGuid(), Guid.NewGuid(), "windows_host", "Test");

        // Act
        asset.MarkDeleted();

        // Assert
        Assert.NotNull(asset.DeletedAt);
        Assert.Equal("deleted", asset.LifecycleStatus);
    }
}
