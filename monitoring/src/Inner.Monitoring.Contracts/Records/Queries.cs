namespace Inner.Monitoring.Contracts.Records;

/// <summary>
/// Query para listagem de assets.
/// </summary>
public sealed record AssetQuery
{
    public Guid? SiteId { get; init; }
    public string? AssetType { get; init; }
    public string? State { get; init; }
    public Guid? SourceId { get; init; }
    public string? Text { get; init; }
    public int? FreshnessMaxSeconds { get; init; }
    public IReadOnlyList<string>? Tags { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
    public string? SortBy { get; init; }
    public bool SortDescending { get; init; } = true;
    public string? Cursor { get; init; }
}

/// <summary>
/// Query para listagem de sources.
/// </summary>
public sealed record SourceQuery
{
    public Guid? SiteId { get; init; }
    public string? SourceType { get; init; }
    public string? Status { get; init; }
    public string? Text { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
    public string? SortBy { get; init; }
    public bool SortDescending { get; init; } = true;
    public string? Cursor { get; init; }
}

/// <summary>
/// Query para listagem de eventos.
/// </summary>
public sealed record EventQuery
{
    public Guid? SiteId { get; init; }
    public Guid? AssetId { get; init; }
    public string? EventType { get; init; }
    public string? Severity { get; init; }
    public string? State { get; init; }
    public DateTimeOffset? From { get; init; }
    public DateTimeOffset? To { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
    public string? SortBy { get; init; }
    public bool SortDescending { get; init; } = true;
    public string? Cursor { get; init; }
}

/// <summary>
/// Resultado paginado.
/// </summary>
/// <typeparam name="T">Tipo dos itens.</typeparam>
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    string? NextCursor);
