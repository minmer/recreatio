package pl.recreatio.app;

import android.Manifest;
import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.provider.Telephony;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * DAS TELEFON FÜR DIE SEITE (Ausgabe „sms", 2026-10-17) — `phone/native.ts`.
 *
 * <code>
 *   status, requestDefault, requestContacts, requestPhoneState, openSettings
 *   threads, messages, part, search, lookup, markRead, viewing, remove, retryMms, recheck
 *   send, threadOf
 *   contacts, writeContacts, dropLocal, contactsSoon
 *   exportMessages, archiveState, setArchiveState, requestSmsRead
 *   lines, setLine, schedule, unschedule, scheduled, forgetScheduled
 *   mute, mutes, block, unblock, blocked, deleteThread, threadSubs   (2026-10-19, {@link Spam})
 *   unsent, dropUnsent   (2026-10-26: was nicht hinausging — zählen, löschen)
 * </code>
 *
 * <p><b>Ein altes Telefon</b> muss nicht die SMS-App sein, um sein Archiv beizutragen:
 * {@code requestSmsRead} fragt nur nach dem Lesen der SMS.</p>
 *
 * <p>Was ankommt, meldet {@link #changed} der offenen Seite ({@code smsChanged}) —
 * das Gespräch auf dem Bildschirm steht dann gleich da.</p>
 *
 * <p><b>Drei eigene Fäden.</b> Capacitor ruft alle Bausteine nacheinander auf EINEM
 * Faden auf; ein langer Auftrag (das Archiv liest Tausende Nachrichten, das Adressbuch
 * schreibt Hunderte Kontakte) hielte sonst jedes Gespräch auf, das man öffnet. Lesen
 * für den Bildschirm, Dateien und Suche, Archiv und Adressbuch laufen deshalb getrennt.</p>
 */
@CapacitorPlugin(
    name = "Phone",
    permissions = {
        @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS }),
        @Permission(alias = "phone", strings = { Manifest.permission.READ_PHONE_STATE }),
        @Permission(alias = "sms", strings = { Manifest.permission.READ_SMS })
    }
)
public class PhonePlugin extends Plugin {

    private static volatile PhonePlugin instance;
    private static volatile long viewing = -1;

    /** Was der Bildschirm gerade braucht: Gespräche, Nachrichten, Namen, Senden. */
    private static final ExecutorService SCREEN = Executors.newSingleThreadExecutor();
    /** Bilder aus MMS und die Suche im Text — dürfen dauern, ohne den Bildschirm aufzuhalten. */
    private static final ExecutorService FILES = Executors.newSingleThreadExecutor();
    /** Archiv und Adressbuch — lange Läufe. */
    private static final ExecutorService WORK = Executors.newSingleThreadExecutor();

    private interface Job {
        JSObject run() throws Exception;
    }

    /** Auf einem eigenen Faden ausführen und dort beantworten ({@code null}: ohne Inhalt). */
    private void on(ExecutorService pool, PluginCall call, Job job) {
        pool.execute(() -> {
            try {
                JSObject out = job.run();
                if (out == null) call.resolve(); else call.resolve(out);
            } catch (Exception e) {
                fail(call, e);
            }
        });
    }

    @Override
    public void load() {
        instance = this;
        SmsNotices.ensureChannel(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /** Im Speicher hat sich etwas geändert — die offene Seite lädt das Gespräch neu. */
    static void changed(long threadId) {
        PhonePlugin plugin = instance;
        if (plugin == null) return;
        JSObject event = new JSObject();
        event.put("threadId", threadId < 0 ? null : String.valueOf(threadId));
        plugin.notifyListeners("smsChanged", event);
    }

    /** Welches Gespräch gerade offen ist — dafür klingelt nichts. */
    static long viewing() {
        return viewing;
    }

    private Context context() {
        return getContext().getApplicationContext();
    }

    private static JSObject js(JSONObject o) {
        try {
            return JSObject.fromJSONObject(o);
        } catch (Exception e) {
            return new JSObject();
        }
    }

    private void fail(PluginCall call, Exception e) {
        call.reject(e.getMessage() == null ? "Nie udało się." : e.getMessage());
    }

    /* -- Wer diese App ist ---------------------------------------------------------------------- */

    private boolean isDefault() {
        Context c = context();
        if (Build.VERSION.SDK_INT >= 29) {
            RoleManager roles = c.getSystemService(RoleManager.class);
            if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_SMS)) return roles.isRoleHeld(RoleManager.ROLE_SMS);
        }
        return c.getPackageName().equals(Telephony.Sms.getDefaultSmsPackage(c));
    }

    private JSONArray sims() {
        JSONArray out = new JSONArray();
        if (getPermissionState("phone") != PermissionState.GRANTED) return out;
        try {
            SubscriptionManager subs = context().getSystemService(SubscriptionManager.class);
            List<SubscriptionInfo> list = subs == null ? null : subs.getActiveSubscriptionInfoList();
            if (list != null) for (SubscriptionInfo info : list) {
                String number = null;
                try {
                    number = Build.VERSION.SDK_INT >= 33 ? subs.getPhoneNumber(info.getSubscriptionId()) : info.getNumber();
                } catch (SecurityException ignored) {
                    // ohne Nummer
                }
                out.put(new JSONObject()
                        .put("subId", info.getSubscriptionId())
                        .put("slot", info.getSimSlotIndex())
                        .put("name", info.getDisplayName() == null ? "SIM " + (info.getSimSlotIndex() + 1) : info.getDisplayName().toString())
                        .put("number", number == null || number.isEmpty() ? JSONObject.NULL : number)
                        .put("mmsMax", SmsSender.mmsMax(context(), info.getSubscriptionId())));
            }
        } catch (Exception ignored) {
            // keine Karten
        }
        return out;
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            JSONObject contacts = PhoneContacts.state(context());
            int sub = SmsSender.defaultSubId();
            long archived = PhoneBridge.archivedAt(context());
            call.resolve(js(new JSONObject()
                    .put("defaultSms", isDefault())
                    .put("roleAvailable", Build.VERSION.SDK_INT < 29 || roleAvailable())
                    .put("contacts", getPermissionState("contacts") == PermissionState.GRANTED)
                    .put("smsRead", isDefault() || getPermissionState("sms") == PermissionState.GRANTED)
                    .put("phoneState", getPermissionState("phone") == PermissionState.GRANTED)
                    .put("notifications", Notices.allowed(context()))
                    .put("sims", sims())
                    .put("defaultSubId", sub >= 0 ? sub : JSONObject.NULL)
                    .put("written", contacts.optInt("written", 0))
                    .put("contactsSyncedAt", contacts.opt("syncedAt"))
                    .put("archivedAt", archived > 0 ? archived : JSONObject.NULL)
                    .put("otherSms", installed(GOOGLE_MESSAGES))
                    .put("device", deviceName())));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    /** Google Messages: mit Czat (RCS) kommen Nachrichten von RCS-Nutzern dort an — nicht als SMS, also nicht hier. */
    private static final String GOOGLE_MESSAGES = "com.google.android.apps.messaging";

    private boolean installed(String pkg) {
        try {
            context().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Wie sich dieses Telefon im Browser nennt („Google Pixel 8") — wer eine Antwort übernommen hat. */
    static String deviceName() {
        String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        String model = Build.MODEL == null ? "" : Build.MODEL;
        String name = model.toLowerCase(java.util.Locale.ROOT).startsWith(maker.toLowerCase(java.util.Locale.ROOT)) ? model : (maker + " " + model).trim();
        return name.isEmpty() ? "Telefon" : name;
    }

    private boolean roleAvailable() {
        if (Build.VERSION.SDK_INT < 29) return true;
        RoleManager roles = context().getSystemService(RoleManager.class);
        return roles != null && roles.isRoleAvailable(RoleManager.ROLE_SMS);
    }

    @PluginMethod
    public void requestDefault(PluginCall call) {
        if (isDefault()) {
            JSObject out = new JSObject();
            out.put("defaultSms", true);
            call.resolve(out);
            return;
        }
        Intent intent;
        if (Build.VERSION.SDK_INT >= 29) {
            RoleManager roles = context().getSystemService(RoleManager.class);
            if (roles == null || !roles.isRoleAvailable(RoleManager.ROLE_SMS)) {
                call.reject("Ten telefon nie pozwala wybrać aplikacji SMS.");
                return;
            }
            intent = roles.createRequestRoleIntent(RoleManager.ROLE_SMS);
        } else {
            intent = new Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, context().getPackageName());
        }
        startActivityForResult(call, intent, "roleResult");
    }

    @ActivityCallback
    private void roleResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        out.put("defaultSms", isDefault());
        call.resolve(out);
    }

    @PluginMethod
    public void requestContacts(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            granted(call, true);
            return;
        }
        requestPermissionForAlias("contacts", call, "contactsResult");
    }

    @PermissionCallback
    private void contactsResult(PluginCall call) {
        granted(call, getPermissionState("contacts") == PermissionState.GRANTED);
    }

    /** Nur lesen (ein altes Telefon, das archivieren soll, ohne SMS-App zu werden). */
    @PluginMethod
    public void requestSmsRead(PluginCall call) {
        if (isDefault() || getPermissionState("sms") == PermissionState.GRANTED) {
            granted(call, true);
            return;
        }
        requestPermissionForAlias("sms", call, "smsResult");
    }

    @PermissionCallback
    private void smsResult(PluginCall call) {
        granted(call, getPermissionState("sms") == PermissionState.GRANTED);
    }

    @PluginMethod
    public void requestPhoneState(PluginCall call) {
        if (getPermissionState("phone") == PermissionState.GRANTED) {
            granted(call, true);
            return;
        }
        requestPermissionForAlias("phone", call, "phoneResult");
    }

    @PermissionCallback
    private void phoneResult(PluginCall call) {
        granted(call, getPermissionState("phone") == PermissionState.GRANTED);
    }

    private static void granted(PluginCall call, boolean yes) {
        JSObject out = new JSObject();
        out.put("granted", yes);
        call.resolve(out);
    }

    /** Die Einstellungen dieser App — dort lässt sich „Allow restricted settings" erlauben (GrapheneOS, Android 13+). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /* -- Lesen ------------------------------------------------------------------------------------ */

    @PluginMethod
    public void threads(PluginCall call) {
        int limit = Math.max(1, Math.min(5000, call.getData().optInt("limit", 500)));
        on(SCREEN, call, () -> js(new JSONObject().put("threads", SmsStore.threads(context(), limit))));
    }

    @PluginMethod
    public void messages(PluginCall call) {
        JSObject data = call.getData();
        on(SCREEN, call, () -> {
            long thread = Long.parseLong(data.getString("threadId"));
            long before = data.has("before") && !data.isNull("before") ? data.getLong("before") : Long.MAX_VALUE;
            int limit = Math.max(1, Math.min(500, data.optInt("limit", 60)));
            return js(SmsStore.messages(context(), thread, before, limit));
        });
    }

    @PluginMethod
    public void part(PluginCall call) {
        JSObject data = call.getData();
        on(FILES, call, () -> js(SmsStore.part(context(), Long.parseLong(data.getString("partId")), Math.max(1, data.optInt("maxBytes", 26 * 1024 * 1024)))));
    }

    @PluginMethod
    public void search(PluginCall call) {
        String query = call.getData().optString("query", "").trim();
        int limit = Math.max(1, Math.min(500, call.getData().optInt("limit", 100)));
        on(FILES, call, () -> js(new JSONObject().put("hits", query.isEmpty() ? new JSONArray() : SmsStore.search(context(), query, limit))));
    }

    @PluginMethod
    public void lookup(PluginCall call) {
        JSONArray numbers = call.getData().optJSONArray("numbers");
        on(SCREEN, call, () -> js(new JSONObject().put("names", numbers == null ? new JSONObject() : SmsStore.names(context(), numbers))));
    }

    @PluginMethod
    public void markRead(PluginCall call) {
        String id = call.getData().getString("threadId");
        on(SCREEN, call, () -> {
            long thread = Long.parseLong(id);
            SmsStore.markRead(context(), thread);
            SmsNotices.cancel(context(), thread);
            return null;
        });
    }

    /**
     * „Sprawdź nowe wiadomości": SMS holt man nicht ab — das Netz bringt sie, und diese App schreibt
     * sie auf. Was sich anstossen lässt: angekündigte MMS noch einmal laden, und sagen, ob die App
     * (noch) die SMS-App ist und ob eine andere Nachrichten wegnehmen kann.
     */
    @PluginMethod
    public void recheck(PluginCall call) {
        on(SCREEN, call, () -> {
            int retried = isDefault() ? MmsReceiver.retryAll(context()) : 0;
            JSObject out = new JSObject();
            out.put("defaultSms", isDefault());
            out.put("otherSms", installed(GOOGLE_MESSAGES));
            out.put("mmsRetried", retried);
            return out;
        });
    }

    @PluginMethod
    public void viewing(PluginCall call) {
        JSObject data = call.getData();
        String thread = data.isNull("threadId") ? null : data.optString("threadId", null);
        try {
            viewing = thread == null ? -1 : Long.parseLong(thread);
        } catch (NumberFormatException e) {
            viewing = -1;
        }
        if (viewing >= 0) SmsNotices.cancel(context(), viewing);
        call.resolve();
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String id = call.getData().getString("id");
        on(SCREEN, call, () -> {
            JSObject out = new JSObject();
            out.put("removed", SmsStore.remove(context(), id));
            return out;
        });
    }

    /** Still: {@code threadId}, {@code until} (ms; 0 = für immer; &lt; 0 = wieder laut). */
    @PluginMethod
    public void mute(PluginCall call) {
        JSObject data = call.getData();
        String id = data.getString("threadId", "");
        long until = data.has("until") ? data.optLong("until", 0) : 0;
        on(SCREEN, call, () -> {
            long thread = Long.parseLong(id);
            Spam.mute(context(), thread, until);
            if (until >= 0) SmsNotices.cancel(context(), thread);
            return null;
        });
    }

    @PluginMethod
    public void mutes(PluginCall call) {
        on(SCREEN, call, () -> js(new JSONObject().put("muted", Spam.mutes(context()))));
    }

    /**
     * Sperren: {@code numbers} (im Telefon, wenn es geht, und hier); mit {@code threadId} ist das
     * Gespräch danach fort.
     */
    @PluginMethod
    public void block(PluginCall call) {
        JSObject data = call.getData();
        on(SCREEN, call, () -> {
            JSONArray numbers = data.optJSONArray("numbers");
            int done = 0;
            for (int i = 0; numbers != null && i < numbers.length(); i++) if (Spam.block(context(), numbers.optString(i, ""))) done++;
            int deleted = 0;
            String thread = data.optString("threadId", "");
            if (!thread.isEmpty()) {
                long id = Long.parseLong(thread);
                deleted = SmsStore.deleteThread(context(), id);
                SmsNotices.cancel(context(), id);
                Spam.mute(context(), id, -1);
                changed(id);
            }
            return js(new JSONObject().put("blocked", done).put("deleted", deleted).put("system", Spam.canBlock(context())));
        });
    }

    @PluginMethod
    public void unblock(PluginCall call) {
        String number = call.getData().getString("number", "");
        on(SCREEN, call, () -> {
            Spam.unblock(context(), number);
            return null;
        });
    }

    @PluginMethod
    public void blocked(PluginCall call) {
        on(SCREEN, call, () -> js(new JSONObject().put("numbers", Spam.blockedList(context())).put("system", Spam.canBlock(context()))));
    }

    /** Ein ganzes Gespräch löschen — vom Telefon (das Archiv bleibt, wie es ist). */
    @PluginMethod
    public void deleteThread(PluginCall call) {
        String id = call.getData().getString("threadId", "");
        on(SCREEN, call, () -> {
            long thread = Long.parseLong(id);
            int deleted = SmsStore.deleteThread(context(), thread);
            SmsNotices.cancel(context(), thread);
            Spam.mute(context(), thread, -1);
            changed(thread);
            return js(new JSONObject().put("deleted", deleted));
        });
    }

    /** Wie viele nicht gesendete älter als {@code before} (ms) — in {@code threadId} oder überall. */
    @PluginMethod
    public void unsent(PluginCall call) {
        JSObject data = call.getData();
        long before = data.optLong("before", System.currentTimeMillis());
        long thread = data.has("threadId") ? Long.parseLong(data.optString("threadId", "-1")) : -1;
        on(SCREEN, call, () -> js(new JSONObject().put("count", SmsStore.unsent(context(), before, thread, true))));
    }

    /** Die nicht gesendeten älter als {@code before} (ms) löschen — in {@code threadId} oder überall. */
    @PluginMethod
    public void dropUnsent(PluginCall call) {
        JSObject data = call.getData();
        long before = data.optLong("before", System.currentTimeMillis());
        long thread = data.has("threadId") ? Long.parseLong(data.optString("threadId", "-1")) : -1;
        on(SCREEN, call, () -> {
            int deleted = SmsStore.unsent(context(), before, thread, false);
            changed(thread);
            return js(new JSONObject().put("deleted", deleted));
        });
    }

    /** Die Karte je Gespräch für Antworten aus der Meldung: {@code subs} = {Gespräch: subId}, -1 = keine eigene. */
    @PluginMethod
    public void threadSubs(PluginCall call) {
        JSObject data = call.getData();
        on(SCREEN, call, () -> {
            JSONObject subs = data.optJSONObject("subs");
            if (subs != null) Spam.threadSubs(context(), subs);
            return null;
        });
    }

    @PluginMethod
    public void retryMms(PluginCall call) {
        String id = call.getData().getString("id");
        on(SCREEN, call, () -> {
            JSObject out = new JSObject();
            out.put("started", MmsReceiver.retry(context(), id));
            return out;
        });
    }

    /* -- Senden ----------------------------------------------------------------------------------- */

    @PluginMethod
    public void send(PluginCall call) {
        on(SCREEN, call, () -> sendNow(call));
    }

    private JSObject sendNow(PluginCall call) throws Exception {
        JSObject data = call.getData();
        JSONArray toArray = data.optJSONArray("to");
        List<String> to = new ArrayList<>();
        if (toArray != null) for (int i = 0; i < toArray.length(); i++) {
            String one = toArray.optString(i, "").trim();
            if (!one.isEmpty()) to.add(one);
        }
        String body = data.optString("body", "");
        if (to.isEmpty()) throw new IllegalArgumentException("Brak odbiorcy.");
        int subId = data.isNull("subId") ? -1 : data.optInt("subId", -1);
        boolean group = data.optBoolean("group", false);
        JSONObject attachment = data.optJSONObject("attachment");
        long thread;
        if (attachment != null || (group && to.size() > 1)) {
            byte[] media = attachment == null ? null : Base64.decode(attachment.optString("data", ""), Base64.DEFAULT);
            String type = attachment == null ? null : attachment.optString("type", "application/octet-stream");
            String name = attachment == null ? null : attachment.optString("name", null);
            if (group || to.size() == 1) {
                thread = SmsSender.sendMms(context(), to, body, media, type, name, subId);
            } else {
                thread = -1;
                for (String one : to) thread = SmsSender.sendMms(context(), java.util.Collections.singletonList(one), body, media, type, name, subId);
            }
        } else {
            if (body.trim().isEmpty()) throw new IllegalArgumentException("Pusta wiadomość.");
            thread = -1;
            for (String one : to) thread = SmsSender.sendSms(context(), one, body, subId);
        }
        PhonePlugin.changed(thread);
        JSObject out = new JSObject();
        out.put("threadId", String.valueOf(thread));
        return out;
    }

    @PluginMethod
    public void threadOf(PluginCall call) {
        try {
            JSONArray addresses = call.getData().optJSONArray("addresses");
            List<String> list = new ArrayList<>();
            if (addresses != null) for (int i = 0; i < addresses.length(); i++) list.add(addresses.optString(i, ""));
            Set<String> set = SmsStore.setOf(list);
            if (set.isEmpty()) { call.reject("Brak odbiorcy."); return; }
            JSObject out = new JSObject();
            out.put("threadId", String.valueOf(SmsStore.threadFor(context(), set)));
            call.resolve(out);
        } catch (Exception e) {
            fail(call, e);
        }
    }

    /* -- Adressbuch ------------------------------------------------------------------------------- */

    @PluginMethod
    public void contacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) { call.reject("Brak dostępu do kontaktów."); return; }
        on(WORK, call, () -> js(new JSONObject().put("contacts", PhoneContacts.read(context()))));
    }

    @PluginMethod
    public void writeContacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) { call.reject("Brak dostępu do kontaktów."); return; }
        JSONArray contacts = call.getData().optJSONArray("contacts");
        on(WORK, call, () -> js(PhoneContacts.write(context(), contacts == null ? new JSONArray() : contacts)));
    }

    /** Die Originale im Gerät entfernen, die schon in recreatio sind (PhoneContacts.dropLocal). */
    @PluginMethod
    public void dropLocal(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) { call.reject("Brak dostępu do kontaktów."); return; }
        JSONArray keys = call.getData().optJSONArray("keys");
        on(WORK, call, () -> js(PhoneContacts.dropLocal(context(), keys == null ? new JSONArray() : keys)));
    }

    /* -- Eigene Nummern, später senden (2026-10-18) ---------------------------------------------- */

    @PluginMethod
    public void lines(PluginCall call) {
        on(SCREEN, call, () -> js(new JSONObject().put("lines", Lines.all(context()))));
    }

    @PluginMethod
    public void setLine(PluginCall call) {
        JSObject data = call.getData();
        Lines.set(context(), data.optInt("subId", -1), data.isNull("number") ? null : data.optString("number", null));
        call.resolve();
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSObject data = call.getData();
        on(SCREEN, call, () -> js(new JSONObject().put("entry", ScheduledSms.add(context(), data))));
    }

    @PluginMethod
    public void unschedule(PluginCall call) {
        String id = call.getData().optString("id", "");
        on(SCREEN, call, () -> {
            JSObject out = new JSObject();
            out.put("removed", ScheduledSms.cancel(context(), id));
            return out;
        });
    }

    @PluginMethod
    public void scheduled(PluginCall call) {
        on(SCREEN, call, () -> js(new JSONObject().put("entries", ScheduledSms.all(context()))));
    }

    @PluginMethod
    public void forgetScheduled(PluginCall call) {
        String id = call.getData().optString("id", "");
        on(SCREEN, call, () -> { ScheduledSms.forget(context(), id); return null; });
    }

    @PluginMethod
    public void contactsSoon(PluginCall call) {
        PhoneWork.contactsSoon(context());
        call.resolve();
    }

    /* -- Archiv ----------------------------------------------------------------------------------- */

    @PluginMethod
    public void exportMessages(PluginCall call) {
        JSObject data = call.getData();
        on(WORK, call, () -> js(SmsStore.exportPage(context(), PhoneBridge.threadOf(data), data.optLong("afterSms", 0), data.optLong("afterMms", 0),
                Math.max(1, Math.min(1000, data.optInt("limit", 300))))));
    }

    @PluginMethod
    public void archiveState(PluginCall call) {
        JSObject out = new JSObject();
        out.put("state", PhoneBridge.state(context()));
        call.resolve(out);
    }

    @PluginMethod
    public void setArchiveState(PluginCall call) {
        JSObject data = call.getData();
        PhoneBridge.setState(context(), data.optString("state", ""), data.optLong("at", 0));
        call.resolve();
    }
}
