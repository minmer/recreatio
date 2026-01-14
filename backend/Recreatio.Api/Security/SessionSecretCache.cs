using System.Collections.Concurrent;

namespace Recreatio.Api.Security;

public sealed record SessionSecret(byte[] MasterKey, RoleKeyRing? CachedRoleKeyRing);

public interface ISessionSecretCache
{
    bool TryGet(string sessionId, out SessionSecret secret);
    void Set(string sessionId, SessionSecret secret);
    void Remove(string sessionId);
}

public sealed class InMemorySessionSecretCache : ISessionSecretCache
{
    private readonly ConcurrentDictionary<string, SessionSecret> _secrets = new();

    public bool TryGet(string sessionId, out SessionSecret secret)
    {
        return _secrets.TryGetValue(sessionId, out secret!);
    }

    public void Set(string sessionId, SessionSecret secret)
    {
        _secrets[sessionId] = secret;
    }

    public void Remove(string sessionId)
    {
        _secrets.TryRemove(sessionId, out _);
    }
}
