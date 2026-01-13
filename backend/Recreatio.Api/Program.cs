using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
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
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection("Auth"));
builder.Services.Configure<CsrfOptions>(builder.Configuration.GetSection("Csrf"));

builder.Services.AddDbContext<RecreatioDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "dataprotection-keys")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("RecreatioWeb", policy =>
    {
        policy.WithOrigins("https://recreatio.pl", "https://recreatio.hostingasp.pl", "http://localhost:5173", "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var isDevelopment = builder.Environment.IsDevelopment();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = isDevelopment ? 1000 : 30;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
});

builder.Services.AddSingleton<IHashingService, HashingService>();
builder.Services.AddSingleton<IKdfService, KdfService>();
builder.Services.AddSingleton<IEncryptionService, EncryptionService>();
builder.Services.AddSingleton<IMasterKeyService, MasterKeyService>();
builder.Services.AddSingleton<ISessionSecretCache, InMemorySessionSecretCache>();
builder.Services.AddScoped<ILedgerService, LedgerService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddScoped<ICsrfService, CsrfService>();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "recreatio.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.CookieManager = new PartitionedCookieManager();
        var cookieDomain = builder.Configuration.GetSection("Auth").GetValue<string?>("CookieDomain");
        if (!string.IsNullOrWhiteSpace(cookieDomain))
        {
            options.Cookie.Domain = cookieDomain;
        }
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(60);
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            }
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
app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok(new { status = "ok", ts = DateTimeOffset.UtcNow }));

app.MapGet("/auth/csrf", (ICsrfService csrfService, HttpContext context) =>
{
    var token = csrfService.IssueToken(context);
    return Results.Ok(new { token });
});

app.MapPost("/auth/register", async (RegisterRequest request, IAuthService authService, ICsrfService csrfService, HttpContext context, CancellationToken ct) =>
{
    if (!csrfService.Validate(context))
    {
        return Results.Forbid();
    }

    try
    {
        var userId = await authService.RegisterAsync(request, ct);
        return Results.Ok(new { userId });
    }
    catch (InvalidOperationException ex)
    {
        return MapAuthException(ex);
    }
}).RequireRateLimiting("auth");

app.MapGet("/auth/salt", async (string loginId, IAuthService authService, CancellationToken ct) =>
{
    var response = await authService.GetSaltAsync(loginId, ct);
    return Results.Ok(response);
}).RequireRateLimiting("auth");

app.MapGet("/auth/availability", async (string loginId, IAuthService authService, CancellationToken ct) =>
{
    var response = await authService.CheckAvailabilityAsync(loginId, ct);
    return Results.Ok(response);
}).RequireRateLimiting("auth");

app.MapPost("/auth/login", async (LoginRequest request, IAuthService authService, ICsrfService csrfService, HttpContext context, CancellationToken ct) =>
{
    if (!csrfService.Validate(context))
    {
        return Results.Forbid();
    }

    try
    {
        var response = await authService.LoginAsync(request, ct);
        var claims = new[]
        {
            new Claim("sub", response.UserId.ToString()),
            new Claim("sid", response.SessionId)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(60)
            });

        csrfService.IssueToken(context);
        return Results.Ok(new { response.UserId, response.SessionId, response.SecureMode });
    }
    catch (InvalidOperationException ex)
    {
        return MapAuthException(ex);
    }
}).RequireRateLimiting("auth");

app.MapPost("/auth/password-change", async (PasswordChangeRequest request, IAuthService authService, ICsrfService csrfService, HttpContext context, CancellationToken ct) =>
{
    if (!TryGetUserId(context, out var userId))
    {
        return Results.Unauthorized();
    }

    if (!csrfService.Validate(context))
    {
        return Results.Forbid();
    }

    try
    {
        await authService.ChangePasswordAsync(userId, request, ct);
        return Results.Ok();
    }
    catch (InvalidOperationException ex)
    {
        return MapAuthException(ex);
    }
}).RequireAuthorization();

app.MapPost("/auth/logout", async (HttpContext context, ISessionService sessionService, ICsrfService csrfService, CancellationToken ct) =>
{
    if (!TryGetUserId(context, out var userId) || !TryGetSessionId(context, out var sessionId))
    {
        return Results.Unauthorized();
    }

    if (!csrfService.Validate(context))
    {
        return Results.Forbid();
    }

    await sessionService.LogoutAsync(userId, sessionId, ct);
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok();
}).RequireAuthorization();

app.MapPost("/auth/session/mode", async (SessionModeRequest request, HttpContext context, ISessionService sessionService, ICsrfService csrfService, CancellationToken ct) =>
{
    if (!TryGetUserId(context, out var userId) || !TryGetSessionId(context, out var sessionId))
    {
        return Results.Unauthorized();
    }

    if (!csrfService.Validate(context))
    {
        return Results.Forbid();
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
    var userIdClaim = context.User.FindFirst("sub")?.Value
        ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return Guid.TryParse(userIdClaim, out userId);
}

static bool TryGetSessionId(HttpContext context, out string sessionId)
{
    sessionId = context.User.FindFirst("sid")?.Value ?? string.Empty;
    return !string.IsNullOrWhiteSpace(sessionId);
}

static IResult MapAuthException(InvalidOperationException ex)
{
    return ex.Message switch
    {
        "LoginId already exists." => Results.Conflict(new { error = ex.Message }),
        "Invalid credentials." => Results.Unauthorized(),
        "Account not active." => Results.StatusCode(StatusCodes.Status403Forbidden),
        "LoginId is required." => Results.BadRequest(new { error = ex.Message }),
        "Account not found." => Results.NotFound(),
        _ => Results.BadRequest(new { error = ex.Message })
    };
}
