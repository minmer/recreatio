/* Read-only: are the migrations 0078–0111 applied, although `app.schema_version` does not list them?
   They were applied one by one, by hand. Every row must say 1 before
   `dotnet run --project backend/Api -- migrate --record-through 0111` records them
   (see documentation/TRANSFER.md). This file is outside the embedded migration directory. */

SELECT m.script, m.marker, m.present FROM (VALUES
  ('0078_seed_deletion', 'slug deletion', CASE WHEN EXISTS (SELECT 1 FROM app.slug WHERE path = N'deletion') THEN 1 ELSE 0 END),
  ('0079_devotions', 'ck_item_kind has devotion', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_item_kind' AND definition LIKE '%devotion%') THEN 1 ELSE 0 END),
  ('0079_devotions', 'ck_calendar_item_kind has devotion', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_calendar_item_kind' AND definition LIKE '%devotion%') THEN 1 ELSE 0 END),
  ('0080_audience', 'audience_form table', CASE WHEN OBJECT_ID('app.audience_form', 'U') IS NOT NULL THEN 1 ELSE 0 END),
  ('0080_audience', 'uq_chat_channel', CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_channel') THEN 1 ELSE 0 END),
  ('0080_audience', 'ck_chat_kind has channel', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chat_kind' AND definition LIKE '%channel%') THEN 1 ELSE 0 END),
  ('0081_seat_starts', 'ck_chat_started', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chat_started') THEN 1 ELSE 0 END),
  ('0081_seat_starts', 'ck_audience_kind has module', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_audience_kind' AND definition LIKE '%module%') THEN 1 ELSE 0 END),
  ('0082_page_subject', 'slug.page_subject', CASE WHEN COL_LENGTH('app.slug', 'page_subject') IS NOT NULL THEN 1 ELSE 0 END),
  ('0083_seed_events', 'slug events', CASE WHEN EXISTS (SELECT 1 FROM app.slug WHERE path = N'events') THEN 1 ELSE 0 END),
  ('0085_presentation', 'ck_slug_page_mode has presentation', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_page_mode' AND definition LIKE '%presentation%') THEN 1 ELSE 0 END),
  ('0086_form_needs', 'slug_field.removed_at', CASE WHEN COL_LENGTH('app.slug_field', 'removed_at') IS NOT NULL THEN 1 ELSE 0 END),
  ('0090_notify_seen', 'notify_seen table', CASE WHEN OBJECT_ID('app.notify_seen') IS NOT NULL THEN 1 ELSE 0 END),
  ('0091_role_access', 'module.member_role_id', CASE WHEN COL_LENGTH('app.module', 'member_role_id') IS NOT NULL THEN 1 ELSE 0 END),
  ('0091_role_access', 'access_role table', CASE WHEN OBJECT_ID('app.access_role') IS NOT NULL THEN 1 ELSE 0 END),
  ('0091_role_access', 'access_role_area view', CASE WHEN OBJECT_ID('app.access_role_area', 'V') IS NOT NULL THEN 1 ELSE 0 END),
  ('0093_person_only', 'slug_field.person_only', CASE WHEN COL_LENGTH('app.slug_field', 'person_only') IS NOT NULL THEN 1 ELSE 0 END),
  ('0095_chat_person', 'chat_message.author_person_id', CASE WHEN COL_LENGTH('app.chat_message', 'author_person_id') IS NOT NULL THEN 1 ELSE 0 END),
  ('0095_chat_person', 'access.invitation_id', CASE WHEN COL_LENGTH('app.access', 'invitation_id') IS NOT NULL THEN 1 ELSE 0 END),
  ('0096_form_groups', 'form_group table', CASE WHEN OBJECT_ID('app.form_group') IS NOT NULL THEN 1 ELSE 0 END),
  ('0096_form_groups', 'module.group_position', CASE WHEN COL_LENGTH('app.module', 'group_position') IS NOT NULL THEN 1 ELSE 0 END),
  ('0097_sealed_names', 'module.name_sealed', CASE WHEN COL_LENGTH('app.module', 'name_sealed') IS NOT NULL THEN 1 ELSE 0 END),
  ('0097_sealed_names', 'access.own_name_sealed', CASE WHEN COL_LENGTH('app.access', 'own_name_sealed') IS NOT NULL THEN 1 ELSE 0 END),
  ('0097_sealed_names', 'claim.host_wrap_public', CASE WHEN COL_LENGTH('app.claim', 'host_wrap_public') IS NOT NULL THEN 1 ELSE 0 END),
  ('0097_sealed_names', 'form_group.name dropped', CASE WHEN COL_LENGTH('app.form_group', 'name') IS NULL THEN 1 ELSE 0 END),
  ('0098_candidate_tasks', 'task_answer table', CASE WHEN OBJECT_ID('app.task_answer') IS NOT NULL THEN 1 ELSE 0 END),
  ('0098_candidate_tasks', 'task_day table', CASE WHEN OBJECT_ID('app.task_day') IS NOT NULL THEN 1 ELSE 0 END),
  ('0099_task_presence', 'task_presence table', CASE WHEN OBJECT_ID('app.task_presence') IS NOT NULL THEN 1 ELSE 0 END),
  ('0099_task_presence', 'form_step.item_id', CASE WHEN COL_LENGTH('app.form_step', 'item_id') IS NOT NULL THEN 1 ELSE 0 END),
  ('0100_step_booking', 'form_step.resource_id', CASE WHEN COL_LENGTH('app.form_step', 'resource_id') IS NOT NULL THEN 1 ELSE 0 END),
  ('0102_step_chat', 'form_step.chat_kind', CASE WHEN COL_LENGTH('app.form_step', 'chat_kind') IS NOT NULL THEN 1 ELSE 0 END),
  ('0108_seed_cogita', 'slug cogita', CASE WHEN EXISTS (SELECT 1 FROM app.slug WHERE path = N'cogita') THEN 1 ELSE 0 END),
  ('0109_cogita', 'cogita_session table', CASE WHEN OBJECT_ID('app.cogita_session', 'U') IS NOT NULL THEN 1 ELSE 0 END),
  ('0109_cogita', 'form_step.learn_threshold', CASE WHEN COL_LENGTH('app.form_step', 'learn_threshold') IS NOT NULL THEN 1 ELSE 0 END),
  ('0109_cogita', 'ck_form_step_kind has learn', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_kind' AND definition LIKE '%learn%') THEN 1 ELSE 0 END),
  ('0109_cogita', 'slug c', CASE WHEN EXISTS (SELECT 1 FROM app.slug WHERE path = N'c') THEN 1 ELSE 0 END),
  ('0110_knowledge_base', 'library.kind', CASE WHEN COL_LENGTH('app.library', 'kind') IS NOT NULL THEN 1 ELSE 0 END),
  ('0110_knowledge_base', 'ck_library_kind', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_library_kind') THEN 1 ELSE 0 END),
  ('0111_chat_send_options', 'chat_message.silent', CASE WHEN COL_LENGTH('app.chat_message', 'silent') IS NOT NULL THEN 1 ELSE 0 END),
  ('0111_chat_send_options', 'chat_message.wait_online_from', CASE WHEN COL_LENGTH('app.chat_message', 'wait_online_from') IS NOT NULL THEN 1 ELSE 0 END),
  ('0111_chat_send_options', 'online table', CASE WHEN OBJECT_ID('app.online', 'U') IS NOT NULL THEN 1 ELSE 0 END)
) AS m(script, marker, present)
ORDER BY m.script;
