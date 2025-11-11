namespace Recreatio.Api.Models
{
    public class Parish
    {
        public int Id { get; set; }

        /// <summary>
        /// Krótka nazwa do URL (np. "parafia-sw-anny").
        /// </summary>
        public string Slug { get; set; } = default!;

        /// <summary>
        /// Pełna nazwa parafii.
        /// </summary>
        public string Name { get; set; } = default!;

        /// <summary>
        /// Miasto / miejscowość.
        /// </summary>
        public string City { get; set; } = default!;
    }
}
