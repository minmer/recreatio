using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Recreatio.Api.Contracts;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Options;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<CryptoOptions>(builder.Configuration.GetSection("Crypto"));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection("Auth"));

builder.Services.AddDbContext<RecreatioDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("RecreatioWeb", policy =>
    {
        policy.WithOrigins("https://recreatio.pl", "http://localhost:5173", "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddSingleton<IHashingService, HashingService>();
builder.Services.AddSingleton<IKdfService, KdfService>();
builder.Services.AddSingleton<IEncryptionService, EncryptionService>();
builder.Services.AddSingleton<IMasterKeyService, MasterKeyService>();
builder.Services.AddSingleton<ISessionSecretCache, InMemorySessionSecretCache>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<ILedgerService, LedgerService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISessionService, SessionService>();

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey))
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseCors("RecreatioWeb");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", ts = DateTimeOffset.UtcNow }));

app.MapPost("/auth/register", async (RegisterRequest request, IAuthService authService, CancellationToken ct) =>
{
    var userId = await authService.RegisterAsync(request, ct);
    return Results.Ok(new { userId });
});

app.MapPost("/auth/login", async (LoginRequest request, IAuthService authService, CancellationToken ct) =>
{
    var response = await authService.LoginAsync(request, ct);
    return Results.Ok(response);
});

app.MapPost("/auth/password-change", async (PasswordChangeRequest request, IAuthService authService, HttpContext context, CancellationToken ct) =>
{
    if (!TryGetUserId(context, out var userId))
    {
        return Results.Unauthorized();
    }

    await authService.ChangePasswordAsync(userId, request, ct);
    return Results.Ok();
}).RequireAuthorization();

app.MapPost("/auth/logout", async (HttpContext context, ISessionService sessionService, CancellationToken ct) =>
{
    if (!TryGetUserId(context, out var userId) || !TryGetSessionId(context, out var sessionId))
    {
        return Results.Unauthorized();
    }

    await sessionService.LogoutAsync(userId, sessionId, ct);
    return Results.Ok();
}).RequireAuthorization();

app.MapPost("/auth/session/mode", async (SessionModeRequest request, HttpContext context, ISessionService sessionService, CancellationToken ct) =>
{
    if (!TryGetUserId(context, out var userId) || !TryGetSessionId(context, out var sessionId))
    {
        return Results.Unauthorized();
    }

    var session = await sessionService.SetSecureModeAsync(userId, sessionId, request.SecureMode, ct);
    return Results.Ok(new { session.SessionId, session.IsSecureMode });
}).RequireAuthorization();

app.MapGet("/auth/me", async (HttpContext context, ISessionService sessionService, CancellationToken ct) =>
{
    if (!TryGetUserId(context, out var userId) || !TryGetSessionId(context, out var sessionId))
    {
        return Results.Unauthorized();
    }

    var session = await sessionService.RequireSessionAsync(userId, sessionId, ct);
    return Results.Ok(new { UserId = userId, session.SessionId, session.IsSecureMode });
}).RequireAuthorization();

app.Run();

static bool TryGetUserId(HttpContext context, out Guid userId)
{
    var userIdClaim = context.User.FindFirst("sub")?.Value;
    return Guid.TryParse(userIdClaim, out userId);
}

static bool TryGetSessionId(HttpContext context, out string sessionId)
{
    sessionId = context.User.FindFirst("sid")?.Value ?? string.Empty;
    return !string.IsNullOrWhiteSpace(sessionId);
}
