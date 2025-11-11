using Microsoft.AspNetCore.Mvc;
using Recreatio.Api.Models;

namespace Recreatio.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ParishesController : ControllerBase
    {
        // Na razie zwracamy listę "na sztywno" – później to zastąpimy bazą danych.
        [HttpGet]
        public ActionResult<IEnumerable<Parish>> Get()
        {
            var parishes = new List<Parish>
            {
                new Parish
                {
                    Id = 1,
                    Slug = "parafia-sw-anny",
                    Name = "Parafia św. Anny",
                    City = "Warszawa"
                },
                new Parish
                {
                    Id = 2,
                    Slug = "parafia-najnajsw-serca-jezusowego",
                    Name = "Parafia Najświętszego Serca Jezusowego",
                    City = "Kraków"
                },
                new Parish
                {
                    Id = 3,
                    Slug = "parafia-sw-jana",
                    Name = "Parafia św. Jana",
                    City = "Poznań"
                }
            };

            return Ok(parishes);
        }
    }
}
