namespace Recreatio.Api.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/account").RequireAuthorization();
        group.MapAccountProfileEndpoints();
        group.MapAccountRoleGraphEndpoints();
        group.MapAccountRoleManagementEndpoints();
        group.MapAccountShareEndpoints();
        group.MapAccountRecoveryEndpoints();
    }
}
