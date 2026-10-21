using System.Diagnostics;
using System.Security.AccessControl;
using System.Security.Principal;
using Inner.Network.Agent.Setup;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class InstallerAclPolicyTests
{
    [Fact]
    public void RepairsExistingProtectedEmptyDaclFileForAllowedIdentity()
    {
        if (!OperatingSystem.IsWindows()) return;

        var root = Path.Combine(Path.GetTempPath(), $"inner-agent-acl-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        var file = Path.Combine(root, "pairing-status.json");
        File.WriteAllText(file, "before");
        try
        {
            var fileInfo = new FileInfo(file);
            var emptyAcl = fileInfo.GetAccessControl();
            emptyAcl.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            foreach (FileSystemAccessRule rule in emptyAcl.GetAccessRules(true, true, typeof(SecurityIdentifier)))
                emptyAcl.RemoveAccessRuleAll(rule);
            fileInfo.SetAccessControl(emptyAcl);

            var allowedSid = WindowsIdentity.GetCurrent().User!;
            InstallerAclPolicy.Apply(root, [allowedSid]);

            Assert.Equal("before", File.ReadAllText(file));
            File.WriteAllText(file, "after");
            Assert.Equal("after", File.ReadAllText(file));
        }
        finally
        {
            var currentSid = WindowsIdentity.GetCurrent().User!;
            if (File.Exists(file))
            {
                var cleanupAcl = new FileInfo(file).GetAccessControl();
                cleanupAcl.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
                cleanupAcl.AddAccessRule(new FileSystemAccessRule(currentSid, FileSystemRights.FullControl, AccessControlType.Allow));
                new FileInfo(file).SetAccessControl(cleanupAcl);
            }
            var directoryAcl = new DirectoryInfo(root).GetAccessControl();
            directoryAcl.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            directoryAcl.AddAccessRule(new FileSystemAccessRule(currentSid, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            new DirectoryInfo(root).SetAccessControl(directoryAcl);
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void RepairsNestedStateFilesAndNewFilesInheritDirectoryAccess()
    {
        if (!OperatingSystem.IsWindows()) return;

        var root = Path.Combine(Path.GetTempPath(), $"inner-agent-acl-{Guid.NewGuid():N}");
        var nested = Path.Combine(root, "state", "secrets");
        Directory.CreateDirectory(nested);
        var files = new[]
        {
            Path.Combine(root, "pairing-status.json"),
            Path.Combine(nested, "agent.db"),
            Path.Combine(nested, "token.json")
        };
        foreach (var file in files) File.WriteAllText(file, "state");

        try
        {
            foreach (var file in files) SetEmptyProtectedDacl(file);
            var allowedSid = WindowsIdentity.GetCurrent().User!;

            InstallerAclPolicy.Apply(root, [allowedSid]);

            foreach (var file in files)
            {
                Assert.Equal("state", File.ReadAllText(file));
                File.WriteAllText(file, "repaired");
                Assert.Equal("repaired", File.ReadAllText(file));
                AssertProtectedFileAcl(file, allowedSid);
            }

            var newDirectory = Path.Combine(nested, "future");
            Directory.CreateDirectory(newDirectory);
            var newFile = Path.Combine(newDirectory, "created-after-repair.json");
            File.WriteAllText(newFile, "inherited");
            Assert.Equal("inherited", File.ReadAllText(newFile));
            Assert.Contains(new FileInfo(newFile).GetAccessControl().GetAccessRules(true, true, typeof(SecurityIdentifier))
                .Cast<FileSystemAccessRule>(), rule => rule.IdentityReference == allowedSid && rule.IsInherited && rule.AccessControlType == AccessControlType.Allow);
            AssertDirectoryAcl(root, allowedSid);
            AssertDirectoryAcl(Path.Combine(root, "state"), allowedSid);
            AssertDirectoryAcl(nested, allowedSid);
        }
        finally
        {
            InstallerAclPolicy.Apply(root, [WindowsIdentity.GetCurrent().User!]);
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void RejectsJunctionBeforeChangingAclOrTouchingItsTarget()
    {
        if (!OperatingSystem.IsWindows()) return;

        var root = Path.Combine(Path.GetTempPath(), $"inner-agent-acl-{Guid.NewGuid():N}");
        var outside = Path.Combine(Path.GetTempPath(), $"inner-agent-acl-outside-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        Directory.CreateDirectory(outside);
        var outsideFile = Path.Combine(outside, "keep.txt");
        File.WriteAllText(outsideFile, "outside");
        var junction = Path.Combine(root, "external");
        try
        {
            using (var process = Process.Start(new ProcessStartInfo("cmd.exe")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                Arguments = $"/c mklink /J \"{junction}\" \"{outside}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true
            })!)
            {
                var output = process.StandardOutput.ReadToEnd();
                var error = process.StandardError.ReadToEnd();
                process.WaitForExit();
                Assert.True(process.ExitCode == 0, $"Could not create junction for test: {output} {error}");
            }

            var allowedSid = WindowsIdentity.GetCurrent().User!;
            var rootSddl = new DirectoryInfo(root).GetAccessControl().GetSecurityDescriptorSddlForm(AccessControlSections.Access);
            var outsideSddl = new FileInfo(outsideFile).GetAccessControl().GetSecurityDescriptorSddlForm(AccessControlSections.Access);

            Assert.Throws<InvalidOperationException>(() => InstallerAclPolicy.Apply(root, [allowedSid]));

            Assert.Equal(rootSddl, new DirectoryInfo(root).GetAccessControl().GetSecurityDescriptorSddlForm(AccessControlSections.Access));
            Assert.Equal(outsideSddl, new FileInfo(outsideFile).GetAccessControl().GetSecurityDescriptorSddlForm(AccessControlSections.Access));
            Assert.Equal("outside", File.ReadAllText(outsideFile));
        }
        finally
        {
            if (Directory.Exists(junction)) Directory.Delete(junction, recursive: false);
            var allowedSid = WindowsIdentity.GetCurrent().User!;
            InstallerAclPolicy.Apply(root, [allowedSid]);
            Directory.Delete(root, recursive: true);
            InstallerAclPolicy.Apply(outside, [allowedSid]);
            Directory.Delete(outside, recursive: true);
        }
    }

    private static void SetEmptyProtectedDacl(string path)
    {
        var file = new FileInfo(path);
        var security = file.GetAccessControl();
        security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
        foreach (FileSystemAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier)))
            security.RemoveAccessRuleAll(rule);
        file.SetAccessControl(security);
    }

    private static void AssertProtectedFileAcl(string path, SecurityIdentifier allowedSid)
    {
        var security = new FileInfo(path).GetAccessControl();
        Assert.True(security.AreAccessRulesProtected);
        var rules = security.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().ToArray();
        var rule = Assert.Single(rules);
        Assert.Equal(allowedSid, rule.IdentityReference);
        Assert.False(rule.IsInherited);
        Assert.Equal(FileSystemRights.FullControl, rule.FileSystemRights & FileSystemRights.FullControl);
        Assert.Equal(AccessControlType.Allow, rule.AccessControlType);
    }

    private static void AssertDirectoryAcl(string path, SecurityIdentifier allowedSid)
    {
        var security = new DirectoryInfo(path).GetAccessControl();
        Assert.True(security.AreAccessRulesProtected);
        var rule = Assert.Single(security.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>());
        Assert.Equal(allowedSid, rule.IdentityReference);
        Assert.Equal(InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, rule.InheritanceFlags);
        Assert.Equal(AccessControlType.Allow, rule.AccessControlType);
    }
}
