using Microsoft.AspNetCore.Mvc;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
///     Health check controller placeholder.
/// </summary>
[ApiController]
[Route("api/monitoring/v1")]
public class HealthController : ControllerBase
{
    /// <summary>
    ///     Health check endpoint.
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "ok", timestamp = DateTimeOffset.UtcNow });
    }
}
