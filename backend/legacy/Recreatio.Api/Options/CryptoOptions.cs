namespace Recreatio.Api.Options;

public sealed class CryptoOptions
{
    public string ServerMasterSalt { get; set; } = string.Empty;
    public int MasterKeyIterations { get; set; } = 600_000;
    public int MasterKeyLengthBytes { get; set; } = 32;
    public int SharedViewIterations { get; set; } = 200_000;
    public int SharedViewKeyLengthBytes { get; set; } = 32;
}
