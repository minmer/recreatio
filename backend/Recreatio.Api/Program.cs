using Recreatio.Api.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRecreatioApi(builder.Configuration, builder.Environment);

var app = builder.Build();
app.UseRecreatioPipeline();
app.Run();
