namespace Recreatio.Api.Options;

public sealed class BlobStorageOptions
{
    public string RootPath { get; set; } = "secure-file-store";
    public int ChunkSizeBytes { get; set; } = 64 * 1024;
    public long MaxUploadBytes { get; set; } = 50L * 1024 * 1024;
}
