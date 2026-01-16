using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Endpoints;
using Recreatio.Api.Options;
using Recreatio.Api.Security;
using Recreatio.Api.Services;
using System.Text;

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
        policy.WithOrigins("https://recreatio.pl", "https://api.recreatio.pl", "http://localhost:5173", "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var isDevelopment = builder.Environment.IsDevelopment();
SameSiteMode ParseSameSiteSetting(string? value, SameSiteMode fallback)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return fallback;
    }

    return Enum.TryParse<SameSiteMode>(value, true, out var parsed) ? parsed : fallback;
}

CookieSecurePolicy ParseSecurePolicySetting(string? value, CookieSecurePolicy fallback)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return fallback;
    }

    return Enum.TryParse<CookieSecurePolicy>(value, true, out var parsed) ? parsed : fallback;
}
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
builder.Services.AddSingleton<IAsymmetricEncryptionService, AsymmetricEncryptionService>();
builder.Services.AddSingleton<IMasterKeyService, MasterKeyService>();
builder.Services.AddSingleton<ISessionSecretCache, InMemorySessionSecretCache>();
builder.Services.AddScoped<IKeyRingService, KeyRingService>();
builder.Services.AddScoped<ILedgerService, LedgerService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddScoped<ICsrfService, CsrfService>();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        var cookieSameSiteSetting = builder.Configuration.GetSection("Auth").GetValue<string?>("CookieSameSite");
        var cookieSecurePolicySetting = builder.Configuration.GetSection("Auth").GetValue<string?>("CookieSecurePolicy");
        var defaultSameSite = isDevelopment ? SameSiteMode.None : SameSiteMode.Lax;
        var defaultSecurePolicy = isDevelopment ? CookieSecurePolicy.None : CookieSecurePolicy.Always;

        options.Cookie.Name = "recreatio.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = ParseSameSiteSetting(cookieSameSiteSetting, defaultSameSite);
        options.Cookie.SecurePolicy = ParseSecurePolicySetting(cookieSecurePolicySetting, defaultSecurePolicy);
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
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var captureBody = path.StartsWith("/account/roles", StringComparison.OrdinalIgnoreCase);

    if (!captureBody)
    {
        await next();
    }
    else
    {
        var originalBody = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        await next();

        buffer.Position = 0;
        if (context.Response.StatusCode is >= 400 and < 500)
        {
            using var reader = new StreamReader(buffer, Encoding.UTF8, leaveOpen: true);
            var bodyText = await reader.ReadToEndAsync();
            if (bodyText.Length > 2000)
            {
                bodyText = bodyText[..2000];
            }
            app.Logger.LogWarning(
                "HTTP {Method} {Path} -> {StatusCode}. Body: {Body}",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                bodyText);
        }

        buffer.Position = 0;
        await buffer.CopyToAsync(originalBody);
        context.Response.Body = originalBody;
    }

    if (context.Response.StatusCode is >= 400 and < 500)
    {
        app.Logger.LogWarning("HTTP {Method} {Path} -> {StatusCode}", context.Request.Method, context.Request.Path, context.Response.StatusCode);
    }
});

app.MapHealthEndpoints();
app.MapAuthEndpoints();
app.MapAccountEndpoints();
app.MapRoleEndpoints();

app.Run();
