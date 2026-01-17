namespace Recreatio.Api.Data;

public enum KeyType
{
    MasterKey = 0,
    RoleReadKey = 1,
    RoleWriteKey = 2,
    DataKey = 3,
    TransferKey = 4,
    AuthorizationPrivateKey = 5,
    AuthorizationPublicKey = 6
}
