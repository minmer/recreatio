using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Options;
using Recreatio.Api.Security;
using Recreatio.Api.Services;

namespace Recreatio.Api.Hosting;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRecreatioApi(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        services.Configure<CryptoOptions>(configuration.GetSection("Crypto"));
        services.Configure<AuthOptions>(configuration.GetSection("Auth"));
        services.Configure<CsrfOptions>(configuration.GetSection("Csrf"));

        services.AddDbContext<RecreatioDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

        services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(environment.ContentRootPath, "dataprotection-keys")));

        services.AddRecreatioCors();
        services.AddRecreatioRateLimiting(environment);
        services.AddRecreatioAuthentication(configuration, environment);
        services.AddRecreatioServices();

        return services;
    }

    public static IServiceCollection AddRecreatioCors(this IServiceCollection services)
    {
        services.AddCors(options =>
        {
            options.AddPolicy("RecreatioWeb", policy =>
            {
                policy.WithOrigins("https://recreatio.pl", "https://api.recreatio.pl", "http://localhost:5173", "https://localhost:5173")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        return services;
    }

    public static IServiceCollection AddRecreatioRateLimiting(this IServiceCollection services, IWebHostEnvironment environment)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddFixedWindowLimiter("auth", limiterOptions =>
            {
                limiterOptions.PermitLimit = environment.IsDevelopment() ? 1000 : 30;
                limiterOptions.Window = TimeSpan.FromMinutes(1);
                limiterOptions.QueueLimit = 0;
            });
        });

        return services;
    }

    public static IServiceCollection AddRecreatioAuthentication(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                var cookieSameSiteSetting = configuration.GetSection("Auth").GetValue<string?>("CookieSameSite");
                var cookieSecurePolicySetting = configuration.GetSection("Auth").GetValue<string?>("CookieSecurePolicy");
                var defaultSameSite = environment.IsDevelopment() ? SameSiteMode.None : SameSiteMode.Lax;
                var defaultSecurePolicy = environment.IsDevelopment() ? CookieSecurePolicy.None : CookieSecurePolicy.Always;

                options.Cookie.Name = "recreatio.auth";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = ParseSameSiteSetting(cookieSameSiteSetting, defaultSameSite);
                options.Cookie.SecurePolicy = ParseSecurePolicySetting(cookieSecurePolicySetting, defaultSecurePolicy);
                var cookieDomain = configuration.GetSection("Auth").GetValue<string?>("CookieDomain");
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

        services.AddAuthorization();

        return services;
    }

    public static IServiceCollection AddRecreatioServices(this IServiceCollection services)
    {
        services.AddSingleton<IHashingService, HashingService>();
        services.AddSingleton<IKdfService, KdfService>();
        services.AddSingleton<IEncryptionService, EncryptionService>();
        services.AddSingleton<IAsymmetricEncryptionService, AsymmetricEncryptionService>();
        services.AddSingleton<IAsymmetricSigningService, AsymmetricSigningService>();
        services.AddSingleton<IMasterKeyService, MasterKeyService>();
        services.AddSingleton<ISessionSecretCache, InMemorySessionSecretCache>();
        services.AddScoped<IKeyRingService, KeyRingService>();
        services.AddScoped<IRoleFieldQueryService, RoleFieldQueryService>();
        services.AddScoped<IRoleFieldValueService, RoleFieldValueService>();
        services.AddScoped<IRoleQueryService, RoleQueryService>();
        services.AddScoped<IRoleCryptoService, RoleCryptoService>();
        services.AddScoped<ILedgerVerificationService, LedgerVerificationService>();
        services.AddScoped<ILedgerService, LedgerService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ISessionService, SessionService>();
        services.AddScoped<ICsrfService, CsrfService>();

        return services;
    }

    private static SameSiteMode ParseSameSiteSetting(string? value, SameSiteMode fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return fallback;
        }

        return Enum.TryParse<SameSiteMode>(value, true, out var parsed) ? parsed : fallback;
    }

    private static CookieSecurePolicy ParseSecurePolicySetting(string? value, CookieSecurePolicy fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return fallback;
        }

        return Enum.TryParse<CookieSecurePolicy>(value, true, out var parsed) ? parsed : fallback;
    }
}
