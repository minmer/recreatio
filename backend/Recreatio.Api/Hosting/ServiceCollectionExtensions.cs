using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography.X509Certificates;
using Recreatio.Api.Crypto;
using Recreatio.Api.Data;
using Recreatio.Api.Options;
using Recreatio.Api.Security;
using Recreatio.Api.Services;
using Recreatio.Api.Services.Chat;
using Recreatio.Api.Services.Cogita;

namespace Recreatio.Api.Hosting;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRecreatioApi(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        services.AddEndpointsApiExplorer();
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new GuidJsonConverterFactory());
        });
        services.AddSwaggerGen();

        services.Configure<CryptoOptions>(configuration.GetSection("Crypto"));
        services.Configure<AuthOptions>(configuration.GetSection("Auth"));
        services.Configure<CsrfOptions>(configuration.GetSection("Csrf"));
        services.Configure<BlobStorageOptions>(configuration.GetSection("BlobStorage"));
        services.Configure<CalendarOptions>(configuration.GetSection("Calendar"));

        services.AddDbContext<RecreatioDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("DefaultConnection"),
                sqlOptions => sqlOptions.UseCompatibilityLevel(120)));

        var dataProtectionBuilder = services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(environment.ContentRootPath, "dataprotection-keys")));
        var dataProtectionCertPath = configuration.GetValue<string?>("DataProtection:CertificatePath");
        var dataProtectionCertPassword = configuration.GetValue<string?>("DataProtection:CertificatePassword");
        var dataProtectionCertThumbprint = configuration.GetValue<string?>("DataProtection:CertificateThumbprint");
        var requireDataProtectionCertificateOutsideDevelopment =
            configuration.GetValue<bool?>("DataProtection:RequireCertificateOutsideDevelopment") ?? false;
        var dataProtectionCert = TryLoadDataProtectionCertificate(dataProtectionCertPath, dataProtectionCertPassword, dataProtectionCertThumbprint);
        if (dataProtectionCert is not null)
        {
            dataProtectionBuilder.ProtectKeysWithCertificate(dataProtectionCert);
        }
        else if (!environment.IsDevelopment() && requireDataProtectionCertificateOutsideDevelopment)
        {
            throw new InvalidOperationException(
                "DataProtection certificate is required outside development. Configure DataProtection:CertificatePath/CertificatePassword or DataProtection:CertificateThumbprint. " +
                "To allow startup without certificate (not recommended), set DataProtection:RequireCertificateOutsideDevelopment=false.");
        }
        else if (!environment.IsDevelopment())
        {
            Console.WriteLine(
                "WARNING: DataProtection certificate is not configured outside development. " +
                "Keys will be persisted without certificate protection because DataProtection:RequireCertificateOutsideDevelopment=false.");
        }

        services.AddRecreatioCors();
        services.AddRecreatioRateLimiting(environment);
        services.AddRecreatioAuthentication(configuration, environment);
        services.AddSignalR();
        services.AddRecreatioServices();

        return services;
    }

    private static X509Certificate2? TryLoadDataProtectionCertificate(
        string? certPath,
        string? certPassword,
        string? certThumbprint)
    {
        if (!string.IsNullOrWhiteSpace(certPath))
        {
            try
            {
                var path = certPath.Trim();
                if (!File.Exists(path))
                {
                    return null;
                }

                return string.IsNullOrEmpty(certPassword)
                    ? new X509Certificate2(path)
                    : new X509Certificate2(path, certPassword);
            }
            catch
            {
                return null;
            }
        }

        if (!string.IsNullOrWhiteSpace(certThumbprint))
        {
            var thumbprint = certThumbprint.Replace(" ", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
            if (thumbprint.Length == 0)
            {
                return null;
            }

            foreach (var storeLocation in new[] { StoreLocation.LocalMachine, StoreLocation.CurrentUser })
            {
                try
                {
                    using var store = new X509Store(StoreName.My, storeLocation);
                    store.Open(OpenFlags.ReadOnly);
                    var matches = store.Certificates.Find(X509FindType.FindByThumbprint, thumbprint, validOnly: false);
                    if (matches.Count > 0)
                    {
                        return matches[0];
                    }
                }
                catch
                {
                    // ignored
                }
            }
        }

        return null;
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
        var authOptions = configuration.GetSection("Auth").Get<AuthOptions>() ?? new AuthOptions();
        var sessionIdleMinutes = Math.Clamp(authOptions.SessionIdleMinutes, 5, 24 * 60);

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
                options.ExpireTimeSpan = TimeSpan.FromMinutes(sessionIdleMinutes);
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
        services.AddScoped<IChatCryptoService, ChatCryptoService>();
        services.AddSingleton<IGameTokenService, GameTokenService>();
        services.AddScoped<IGameSessionService, GameSessionService>();
        services.AddScoped<IGameRuleEngineService, GameRuleEngineService>();
        services.AddScoped<IGameLocationService, GameLocationService>();
        services.AddScoped<IGameRealtimeService, GameRealtimeService>();
        services.AddScoped<ICalendarGraphRuntimeService, CalendarGraphRuntimeService>();
        services.AddHttpClient("calendar-reminder-webhook", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
        });
        services.AddHostedService<CalendarReminderDispatcherHostedService>();
        services.AddHostedService<GameRetentionCleanupHostedService>();
        services.AddSingleton<IEncryptedBlobStore, EncryptedBlobStore>();

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
