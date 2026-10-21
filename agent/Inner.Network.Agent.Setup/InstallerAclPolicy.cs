using System.Security.AccessControl;
using System.Security.Principal;

namespace Inner.Network.Agent.Setup;

public static class InstallerAclPolicy
{
    public static void Apply(
        string root,
        IReadOnlyCollection<SecurityIdentifier> allowedSids,
        Action<string>? recoverOwnership = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(root);
        ArgumentNullException.ThrowIfNull(allowedSids);
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("A política de ACL do instalador requer Windows.");
        if (allowedSids.Count == 0) throw new ArgumentException("Ao menos uma identidade permitida é necessária.", nameof(allowedSids));

        var fullRoot = Path.GetFullPath(root);
        EnsurePathHasNoReparsePoints(fullRoot);
        if (!Directory.Exists(fullRoot) || Path.GetPathRoot(fullRoot)!.Equals(fullRoot, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("A raiz da ACL deve ser uma pasta existente diferente da raiz do volume.");

        var targets = EnumerateTreeWithoutReparsePoints(fullRoot);
        foreach (var target in targets)
        {
            try
            {
                ApplyObjectAcl(target, allowedSids);
            }
            catch (UnauthorizedAccessException) when (recoverOwnership is not null)
            {
                EnsurePathHasNoReparsePoints(target);
                recoverOwnership(target);
                ApplyObjectAcl(target, allowedSids);
            }
        }
    }

    internal static void EnsurePathHasNoReparsePoints(string path)
    {
        var fullPath = Path.GetFullPath(path);
        var volumeRoot = Path.GetPathRoot(fullPath)
            ?? throw new InvalidOperationException("O caminho ACL precisa ser absoluto.");
        var relative = fullPath[volumeRoot.Length..];
        var current = volumeRoot;
        foreach (var segment in relative.Split([Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar], StringSplitOptions.RemoveEmptyEntries))
        {
            current = Path.Combine(current, segment);
            var attributes = File.GetAttributes(current);
            if ((attributes & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException($"A ACL não será aplicada através de reparse point: {current}");
        }
    }

    private static List<string> EnumerateTreeWithoutReparsePoints(string root)
    {
        var result = new List<string> { root };
        var pending = new Stack<string>();
        pending.Push(root);
        while (pending.Count > 0)
        {
            var directory = pending.Pop();
            foreach (var child in Directory.EnumerateFileSystemEntries(directory))
            {
                var attributes = File.GetAttributes(child);
                if ((attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidOperationException($"A ACL não será aplicada através de reparse point: {child}");
                result.Add(child);
                if ((attributes & FileAttributes.Directory) != 0) pending.Push(child);
            }
        }
        return result;
    }

    private static void ApplyObjectAcl(string path, IReadOnlyCollection<SecurityIdentifier> allowedSids)
    {
        var attributes = File.GetAttributes(path);
        if ((attributes & FileAttributes.Directory) != 0)
        {
            var security = new DirectoryInfo(path).GetAccessControl(AccessControlSections.Access);
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            ClearAccessRules(security);
            foreach (var sid in allowedSids)
                security.AddAccessRule(new FileSystemAccessRule(
                    sid,
                    FileSystemRights.FullControl,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                    PropagationFlags.None,
                    AccessControlType.Allow));
            new DirectoryInfo(path).SetAccessControl(security);
            return;
        }

        var fileSecurity = new FileInfo(path).GetAccessControl(AccessControlSections.Access);
        fileSecurity.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
        ClearAccessRules(fileSecurity);
        foreach (var sid in allowedSids)
            fileSecurity.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl, AccessControlType.Allow));
        new FileInfo(path).SetAccessControl(fileSecurity);
    }

    private static void ClearAccessRules(FileSystemSecurity security)
    {
        foreach (FileSystemAccessRule rule in security.GetAccessRules(includeExplicit: true, includeInherited: true, targetType: typeof(SecurityIdentifier)))
            security.RemoveAccessRuleAll(rule);
    }
}
