using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Recreatio.Api.Options;

namespace Recreatio.Api.Services;

public interface IEncryptedBlobStore
{
    long MaxUploadBytes { get; }
    Task<EncryptedBlobWriteResult> WriteEncryptedAsync(Stream plaintext, byte[] dataKey, Guid dataItemId, CancellationToken ct);
    Task<bool> DecryptToStreamAsync(string storagePath, byte[] dataKey, Guid dataItemId, Stream plaintextDestination, CancellationToken ct);
    Task DeleteIfExistsAsync(string storagePath, CancellationToken ct);
}

public sealed record EncryptedBlobWriteResult(
    string StoragePath,
    long PlaintextLength,
    byte[] PlaintextSha256
);

public sealed class EncryptedBlobStore : IEncryptedBlobStore
{
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private const int Version = 1;
    private const int IoBufferSize = 81920;
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("RCBLOB");
    private static readonly Encoding Utf8 = Encoding.UTF8;

    private readonly string _rootPath;
    private readonly int _chunkSizeBytes;

    public long MaxUploadBytes { get; }

    public EncryptedBlobStore(IOptions<BlobStorageOptions> options, IWebHostEnvironment environment)
    {
        var config = options.Value;

        var rootPath = string.IsNullOrWhiteSpace(config.RootPath) ? "secure-file-store" : config.RootPath.Trim();
        if (!Path.IsPathRooted(rootPath))
        {
            rootPath = Path.Combine(environment.ContentRootPath, rootPath);
        }

        _rootPath = Path.GetFullPath(rootPath);
        Directory.CreateDirectory(_rootPath);

        _chunkSizeBytes = config.ChunkSizeBytes <= 0 ? 64 * 1024 : config.ChunkSizeBytes;
        MaxUploadBytes = config.MaxUploadBytes <= 0 ? 50L * 1024 * 1024 : config.MaxUploadBytes;
    }

    public async Task<EncryptedBlobWriteResult> WriteEncryptedAsync(
        Stream plaintext,
        byte[] dataKey,
        Guid dataItemId,
        CancellationToken ct)
    {
        var timestamp = DateTime.UtcNow;
        var storagePath = $"{timestamp:yyyy}/{timestamp:MM}/{timestamp:dd}/{Guid.NewGuid():N}.rce";
        var absolutePath = ResolveStoragePath(storagePath);
        var directory = Path.GetDirectoryName(absolutePath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await using var output = new FileStream(
            absolutePath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            IoBufferSize,
            FileOptions.Asynchronous);

        var header = new byte[Magic.Length + 1 + sizeof(int)];
        Buffer.BlockCopy(Magic, 0, header, 0, Magic.Length);
        header[Magic.Length] = Version;
        BinaryPrimitives.WriteInt32LittleEndian(header.AsSpan(Magic.Length + 1), _chunkSizeBytes);
        await output.WriteAsync(header, ct);

        var plaintextBuffer = new byte[_chunkSizeBytes];
        var lengthBuffer = new byte[sizeof(int)];
        var totalBytes = 0L;
        var chunkIndex = 0;
        using var aes = new AesGcm(dataKey, TagSize);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);

        while (true)
        {
            var read = await plaintext.ReadAsync(plaintextBuffer, ct);
            if (read == 0)
            {
                break;
            }

            totalBytes += read;
            hash.AppendData(plaintextBuffer, 0, read);

            var nonce = RandomNumberGenerator.GetBytes(NonceSize);
            var ciphertext = new byte[read];
            var tag = new byte[TagSize];
            var aad = BuildChunkAad(dataItemId, chunkIndex);
            aes.Encrypt(nonce, plaintextBuffer.AsSpan(0, read), ciphertext, tag, aad);

            BinaryPrimitives.WriteInt32LittleEndian(lengthBuffer, read);
            await output.WriteAsync(lengthBuffer, ct);
            await output.WriteAsync(nonce, ct);
            await output.WriteAsync(ciphertext, ct);
            await output.WriteAsync(tag, ct);
            chunkIndex++;
        }

        await output.FlushAsync(ct);
        return new EncryptedBlobWriteResult(storagePath, totalBytes, hash.GetHashAndReset());
    }

    public async Task<bool> DecryptToStreamAsync(
        string storagePath,
        byte[] dataKey,
        Guid dataItemId,
        Stream plaintextDestination,
        CancellationToken ct)
    {
        var absolutePath = ResolveStoragePath(storagePath);
        if (!File.Exists(absolutePath))
        {
            return false;
        }

        await using var input = new FileStream(
            absolutePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            IoBufferSize,
            FileOptions.Asynchronous | FileOptions.SequentialScan);

        var headerLength = Magic.Length + 1 + sizeof(int);
        var header = new byte[headerLength];
        if (!await TryReadExactAsync(input, header, ct))
        {
            return false;
        }

        for (var i = 0; i < Magic.Length; i++)
        {
            if (header[i] != Magic[i])
            {
                return false;
            }
        }

        if (header[Magic.Length] != Version)
        {
            return false;
        }

        var chunkSize = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(Magic.Length + 1));
        if (chunkSize <= 0)
        {
            return false;
        }

        var lengthBuffer = new byte[sizeof(int)];
        using var aes = new AesGcm(dataKey, TagSize);
        var chunkIndex = 0;
        while (true)
        {
            var bytesRead = await input.ReadAsync(lengthBuffer, ct);
            if (bytesRead == 0)
            {
                break;
            }

            if (bytesRead != sizeof(int))
            {
                return false;
            }

            var plaintextLength = BinaryPrimitives.ReadInt32LittleEndian(lengthBuffer);
            if (plaintextLength < 0 || plaintextLength > chunkSize * 8)
            {
                return false;
            }

            var nonce = new byte[NonceSize];
            if (!await TryReadExactAsync(input, nonce, ct))
            {
                return false;
            }

            var ciphertext = new byte[plaintextLength];
            if (!await TryReadExactAsync(input, ciphertext, ct))
            {
                return false;
            }

            var tag = new byte[TagSize];
            if (!await TryReadExactAsync(input, tag, ct))
            {
                return false;
            }

            var plaintextChunk = new byte[plaintextLength];
            var aad = BuildChunkAad(dataItemId, chunkIndex);
            aes.Decrypt(nonce, ciphertext, tag, plaintextChunk, aad);
            await plaintextDestination.WriteAsync(plaintextChunk, ct);
            chunkIndex++;
        }

        await plaintextDestination.FlushAsync(ct);
        return true;
    }

    public Task DeleteIfExistsAsync(string storagePath, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var absolutePath = ResolveStoragePath(storagePath);
        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }

        return Task.CompletedTask;
    }

    private string ResolveStoragePath(string storagePath)
    {
        if (string.IsNullOrWhiteSpace(storagePath))
        {
            throw new InvalidOperationException("Storage path is missing.");
        }

        var normalized = storagePath.Replace('\\', '/').Trim();
        if (normalized.StartsWith("/", StringComparison.Ordinal) || normalized.Contains("..", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Storage path is invalid.");
        }

        var candidate = Path.GetFullPath(Path.Combine(_rootPath, normalized.Replace('/', Path.DirectorySeparatorChar)));
        var relative = Path.GetRelativePath(_rootPath, candidate);
        if (relative.StartsWith("..", StringComparison.Ordinal) || Path.IsPathRooted(relative))
        {
            throw new InvalidOperationException("Storage path is outside root.");
        }

        return candidate;
    }

    private static byte[] BuildChunkAad(Guid dataItemId, int chunkIndex)
    {
        return Utf8.GetBytes($"{dataItemId:D}:chunk:{chunkIndex}");
    }

    private static async Task<bool> TryReadExactAsync(Stream stream, byte[] buffer, CancellationToken ct)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset, buffer.Length - offset), ct);
            if (read == 0)
            {
                return false;
            }
            offset += read;
        }

        return true;
    }
}
