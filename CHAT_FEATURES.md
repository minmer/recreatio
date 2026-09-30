# Chat features and deployment

The workspace, embedded page chat, and seat-link chat share the new message controls. Existing signed, encrypted text messages and edit history remain compatible.

Implemented:

- Persistent scheduled delivery while the sender is offline, with encrypted sender-only previews, rescheduling and cancellation. The API worker checks every five seconds and catches up after restart. Pending/failed/cancelled messages are excluded from public history, versions, unread counts and last-message times. Scheduling is limited to the next year.
- Weekly availability with multiple intervals, weekday selection and a named time zone. Common account settings apply to all chats; a chat can override them or restore inheritance. Quiet hours affect browser notifications, not delivery. Sharing availability and read receipts is opt-in. Read receipts use the timestamp of messages actually fetched by the visible chat.
- Channels use the area's certificates: `write`/`admin` can publish; `read` and seat links can read. New group channels invite readers. Existing area chats can switch policy in settings. Editing, restoring, attachments and scheduled delivery enforce posting rules. Participant permissions are managed through the linked area.
- Replies, forwarding between account chats (attachments are decrypted and re-encrypted for the destination), microphone voice messages (up to five minutes), reactions, shared moderator pins, private saved messages, search of loaded/decrypted history (including attachment names), typing indicators, archive filtering, mute controls and opt-in browser notifications. Existing edit/delete/restore/version-history and unread features continue to work.
- Files, images, audio/music and video. The browser creates a random AES-256-GCM key per file using the existing authenticated encryption format. Only ciphertext is uploaded as a binary body. File names, media types and keys travel inside the encrypted, signed message. The database stores an opaque file identifier, chat, uploader, size and timestamp—not file bytes. Downloads require current chat access. Decryption happens in the browser; object URLs are revoked when the preview is removed. Eight attachments per composer, up to approximately 50 MiB each; the API enforces a 50 MiB ciphertext limit and 1 GiB daily upload quota per account/seat.

## Deployment

1. Back up the database and apply the normal API migrations, including `0060_chat_features.sql`, before starting the new API:
   ```sh
   dotnet run --project backend/Api -- migrate
   ```
2. Set `Chat:AttachmentDirectory` (environment variable `Chat__AttachmentDirectory`) to a persistent, private directory **outside the public web root and outside release directories**. Grant the API service account read/write access. Local development defaults to `private-chat-files` beside the API executable. Multiple API instances must share this directory.
3. Back up that directory together with the database. Losing ciphertext files cannot be repaired from SQL. Existing message deletion is reversible, so files are retained with message history; uploads interrupted before message submission may remain and count toward the daily quota.
4. Configure the reverse proxy/IIS request limit to allow 52,428,800 bytes. The API applies its own limit too. Keep the API process running (disable idle shutdown or use always-on hosting) for timely scheduled delivery. Delivery resumes after downtime; it is not guaranteed at an exact second.
5. Deploy the frontend bundle. No plaintext file conversion or legacy attachment migration is performed.

If an area's encryption epoch changes before a scheduled message is due, or its author loses posting permission, the worker marks it failed instead of delivering under stale permissions/keys. The sender can cancel it and compose a fresh message. A role/seat that loses all chat access cannot retrieve the private queue through that chat.

Browser notifications work while the application is open and the browser permits them; this implementation does not add a push-notification service for a closed application. Live voice/video calls are outside this change. Forwarding is available to signed-in accounts; seat links remain restricted to their area chat. Search is local to loaded history to preserve end-to-end encryption; load earlier messages to widen it.

## Verification

```sh
npm --prefix frontend run app:check
npm --prefix frontend run build
dotnet run --project backend/Api.Tests
```

Automated tests cover channel posting policy, scheduling boundaries, weekly availability including daylight-saving time, authenticated encryption/wrong-key/tamper failures, encrypted upload/download transport, and attachment/reply preservation across edits. The production frontend build and backend build are checked separately. A live SQL migration and multi-user HTTP tests require a test database and have not been run in this workspace.

Database-backed acceptance checks before release:

- Apply migration 0060 to a disposable database after 0059. Start two API instances and schedule more than 60 messages for the same time; each must arrive once and all must paginate.
- Restart the API before delivery; then repeat after revoking the sender's certificate, revoking a seat, switching an area chat to a channel, and rotating the area epoch. Unauthorized/stale messages must fail and remain invisible to other participants, including through version endpoints.
- Test channel read/write/admin/certify certificates and a seat link against posting, edit, restore, typing, upload, scheduling and rescheduling. Read-only members may react and save messages; only moderators may pin.
- Download an attachment as a member, outsider, revoked member and unrelated seat. Only the current chat member/seat should receive ciphertext. Inspect storage and SQL to confirm only the disk contains file bytes.
- Verify availability inheritance and override reset, mute/archive controls, read-receipt opt-in and opt-out, and quiet-hour boundaries with two accounts and a seat link.
