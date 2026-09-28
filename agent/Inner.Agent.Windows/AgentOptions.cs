namespace Inner.Agent.Windows;

public sealed class AgentOptions
{
    public string ApiBaseUrl { get; set; } = string.Empty;
    public int CollectionIntervalSeconds { get; set; } = 60;
    public string BootstrapFile { get; set; } = "bootstrap.json";
    public string DataDirectory { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "InnerWorks",
        "InnerAgent");
}
