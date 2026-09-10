using System.Text.Json;
using System.Text.Json.Serialization;

namespace Recreatio.Api.Hosting;

public sealed class GuidJsonConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert)
    {
        return typeToConvert == typeof(Guid) || typeToConvert == typeof(Guid?);
    }

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        if (typeToConvert == typeof(Guid))
        {
            return new GuidJsonConverter();
        }

        return new NullableGuidJsonConverter();
    }

    private sealed class GuidJsonConverter : JsonConverter<Guid>
    {
        public override Guid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType != JsonTokenType.String)
            {
                throw new JsonException("Expected GUID string.");
            }

            var value = reader.GetString();
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new JsonException("GUID value is empty.");
            }

            if (TryParseGuid(value, out var guid))
            {
                return guid;
            }

            throw new JsonException("GUID value is not in a supported format.");
        }

        public override void Write(Utf8JsonWriter writer, Guid value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(value);
        }
    }

    private sealed class NullableGuidJsonConverter : JsonConverter<Guid?>
    {
        public override Guid? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
            {
                return null;
            }

            if (reader.TokenType != JsonTokenType.String)
            {
                throw new JsonException("Expected GUID string.");
            }

            var value = reader.GetString();
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            if (TryParseGuid(value, out var guid))
            {
                return guid;
            }

            throw new JsonException("GUID value is not in a supported format.");
        }

        public override void Write(Utf8JsonWriter writer, Guid? value, JsonSerializerOptions options)
        {
            if (value is null)
            {
                writer.WriteNullValue();
                return;
            }

            writer.WriteStringValue(value.Value);
        }
    }

    private static bool TryParseGuid(string value, out Guid guid)
    {
        return Guid.TryParseExact(value, "N", out guid)
            || Guid.TryParseExact(value, "D", out guid)
            || Guid.TryParseExact(value, "B", out guid)
            || Guid.TryParseExact(value, "P", out guid)
            || Guid.TryParse(value, out guid);
    }
}
