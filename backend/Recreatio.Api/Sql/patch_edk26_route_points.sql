-- EDK26 route points patch
-- Purpose: backfill URL and distance values for routePoints in already provisioned edk26 site configs.

SET NOCOUNT ON;

DECLARE @routePointsJson NVARCHAR(MAX) = N'[
  {"type":"start","title_pl":"Punkt startowy","url":"https://maps.app.goo.gl/JbKuRvUNriWWKGJH7","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"2,1 km"},
  {"type":"station","title_pl":"Stacja I — Jezus na śmierć skazany","url":"https://maps.app.goo.gl/P2Jv3Up112DMAy5PA","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"2,3 km"},
  {"type":"station","title_pl":"Stacja II — Jezus bierze krzyż na swoje ramiona","url":"https://maps.app.goo.gl/xjWWJFudVoewKQSj6","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"3,2 km"},
  {"type":"station","title_pl":"Stacja III — Jezus upada po raz pierwszy","url":"https://maps.app.goo.gl/By6JyayGQByDXHvV7","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"1,6 km"},
  {"type":"station","title_pl":"Stacja IV — Jezus spotyka swoją Matkę","url":"https://maps.app.goo.gl/dwfAeLRieQGjZ5eQA","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"2,5 km"},
  {"type":"station","title_pl":"Stacja V — Szymon z Cyreny pomaga nieść krzyż Jezusowi","url":"https://maps.app.goo.gl/eBYb9tSkFLzucwGy8","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"2,8 km"},
  {"type":"station","title_pl":"Stacja VI — Weronika ociera twarz Jezusowi","url":"https://maps.app.goo.gl/T8rbSyY2MLTV77949","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"3,5 km"},
  {"type":"station","title_pl":"Stacja VII — Jezus upada po raz drugi","url":"https://maps.app.goo.gl/Mq534arWZD8S8hkc6","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"2,2 km"},
  {"type":"station","title_pl":"Stacja VIII — Jezus pociesza płaczące niewiasty","url":"https://maps.app.goo.gl/x4zEUUuRxa1BqJBM7","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"2,6 km"},
  {"type":"station","title_pl":"Stacja IX — Jezus upada po raz trzeci","url":"https://maps.app.goo.gl/op9yy4LwFrFBigq68","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"1,7 km"},
  {"type":"station","title_pl":"Stacja X — Jezus z szat obnażony","url":"https://maps.app.goo.gl/9PS81EWU4AJ7D9CW7","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"2,2 km"},
  {"type":"station","title_pl":"Stacja XI — Jezus przybity do krzyża","url":"https://maps.app.goo.gl/inh6p8ypkRQXYpzGA","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"2,7 km"},
  {"type":"station","title_pl":"Stacja XII — Jezus umiera na krzyżu","url":"https://maps.app.goo.gl/Nbr1DKH7E9ioENvU7","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"1,9 km"},
  {"type":"station","title_pl":"Stacja XIII — Jezus zdjęty z krzyża","url":"https://maps.app.goo.gl/rapW9iQ6TBzdXirW9","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do kolejnego punktu","url":"","distance_km":"1,5 km"},
  {"type":"station","title_pl":"Stacja XIV — Jezus złożony do grobu","url":"https://maps.app.goo.gl/o17uTobMpE3fHyEh8","distance_km":""},
  {"type":"distance","title_pl":"+ odległość do mety","url":"","distance_km":"0,6 km"},
  {"type":"finish","title_pl":"Punkt końcowy","url":"https://maps.app.goo.gl/Ram1tdB3hcbY1D5Y8","distance_km":""}
]';

IF ISJSON(@routePointsJson) <> 1
BEGIN
    THROW 51010, 'patch_edk26_route_points: routePoints JSON is invalid.', 1;
END

UPDATE cfg
SET
    SiteConfigJson = JSON_MODIFY(
        CASE WHEN ISJSON(cfg.SiteConfigJson) = 1 THEN cfg.SiteConfigJson ELSE N'{}' END,
        '$.routePoints',
        JSON_QUERY(@routePointsJson)
    ),
    UpdatedUtc = SYSDATETIMEOFFSET()
FROM edk.EdkSiteConfigs AS cfg
INNER JOIN edk.EdkEvents AS evt ON evt.Id = cfg.EventId
WHERE evt.Slug = N'edk26'
  AND cfg.IsPublished = 1;
