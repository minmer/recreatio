namespace Recreatio.Api.Endpoints;

public static class AccountRoleManagementEndpoints
{
    public static void MapAccountRoleManagementEndpoints(this RouteGroupBuilder group)
    {
        group.MapAccountRoleCreationEndpoints();
        group.MapAccountRoleFieldEndpoints();
        group.MapAccountDataEndpoints();
        group.MapAccountRoleAccessEndpoints();
        group.MapAccountRoleParentEndpoints();
        group.MapAccountRoleVerificationEndpoints();
    }
}
