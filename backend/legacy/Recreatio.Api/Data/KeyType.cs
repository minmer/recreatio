namespace Recreatio.Api.Data;

public enum KeyType
{
    MasterKey = 0,
    RoleReadKey = 1,
    RoleWriteKey = 2,
    RoleOwnerKey = 3,
    DataKey = 4,
    TransferKey = 5,
    AuthorizationPrivateKey = 6,
    AuthorizationPublicKey = 7
}
