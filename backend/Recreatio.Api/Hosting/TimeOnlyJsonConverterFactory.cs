using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Recreatio.Api.Hosting;

/// <summary>
/// Accepts clock times the way browsers send them. An <c>&lt;input type="time"&gt;</c> yields
/// "09:00", which the built-in converter rejects because it insists on seconds. Values are always
/// written back as "HH:mm:ss", the same shape the default converter produces for whole minutes.
/// </summary>
public sealed class TimeOnlyJsonConverterFactory : JsonConverterFactory
{
    private static readonly string[] AcceptedFormats =
    [
        "HH:mm",
        "HH:mm:ss",
        "HH:mm:ss.f",
        "HH:mm:ss.ff",
        "HH:mm:ss.fff",
        "HH:mm:ss.ffffff",
        "HH:mm:ss.fffffff"
    ];

    public override bool CanConvert(Type typeToConvert) =>
        typeToConvert == typeof(TimeOnly) || typeToConvert == typeof(TimeOnly?);

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        typeToConvert == typeof(TimeOnly)
            ? new TimeOnlyJsonConverter()
            : new NullableTimeOnlyJsonConverter();

    private static bool TryParse(string? value, out TimeOnly time)
    {
        time = default;
        return !string.IsNullOrWhiteSpace(value)
            && TimeOnly.TryParseExact(value.Trim(), AcceptedFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
    }

    private static void Write(Utf8JsonWriter writer, TimeOnly value) =>
        writer.WriteStringValue(value.ToString("HH:mm:ss", CultureInfo.InvariantCulture));

    private sealed class TimeOnlyJsonConverter : JsonConverter<TimeOnly>
    {
        public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType != JsonTokenType.String || !TryParse(reader.GetString(), out var time))
            {
                throw new JsonException("Expected a time of day such as \"09:00\" or \"09:00:00\".");
            }

            return time;
        }

        public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options) =>
            TimeOnlyJsonConverterFactory.Write(writer, value);
    }

    private sealed class NullableTimeOnlyJsonConverter : JsonConverter<TimeOnly?>
    {
        public override TimeOnly? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
            {
                return null;
            }

            if (reader.TokenType != JsonTokenType.String)
            {
                throw new JsonException("Expected a time of day such as \"09:00\" or \"09:00:00\".");
            }

            var raw = reader.GetString();
            if (string.IsNullOrWhiteSpace(raw))
            {
                return null;
            }

            if (!TryParse(raw, out var time))
            {
                throw new JsonException("Expected a time of day such as \"09:00\" or \"09:00:00\".");
            }

            return time;
        }

        public override void Write(Utf8JsonWriter writer, TimeOnly? value, JsonSerializerOptions options)
        {
            if (value is null)
            {
                writer.WriteNullValue();
                return;
            }

            TimeOnlyJsonConverterFactory.Write(writer, value.Value);
        }
    }
}
