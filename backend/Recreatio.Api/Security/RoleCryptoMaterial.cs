namespace Recreatio.Api.Security;

public sealed record RoleCryptoMaterial(
    string PrivateEncryptionKeyBase64,
    string PrivateEncryptionKeyAlg
);
