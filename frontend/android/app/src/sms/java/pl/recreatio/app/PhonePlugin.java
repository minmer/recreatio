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

/**
 * DAS TELEFON FÜR DIE SEITE (Ausgabe „sms", 2026-10-17) — `phone/native.ts`.
 *
 * <code>
 *   status, requestDefault, requestContacts, requestPhoneState, openSettings
 *   threads, messages, part, search, lookup, markRead, viewing, remove, retryMms
 *   send, threadOf
 *   contacts, writeContacts, contactsSoon
 *   exportMessages, archiveMarkers, setArchiveMarkers
 * </code>
 *
 * <p>Was ankommt, meldet {@link #changed} der offenen Seite ({@code smsChanged}) —
 * das Gespräch auf dem Bildschirm steht dann gleich da.</p>
 */
@CapacitorPlugin(
    name = "Phone",
    permissions = {
        @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS }),
        @Permission(alias = "phone", strings = { Manifest.permission.READ_PHONE_STATE })
    }
)
public class PhonePlugin extends Plugin {

    private static volatile PhonePlugin instance;
    private static volatile long viewing = -1;

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
                        .put("number", number == null || number.isEmpty() ? JSONObject.NULL : number));
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
                    .put("phoneState", getPermissionState("phone") == PermissionState.GRANTED)
                    .put("notifications", Notices.allowed(context()))
                    .put("sims", sims())
                    .put("defaultSubId", sub >= 0 ? sub : JSONObject.NULL)
                    .put("written", contacts.optInt("written", 0))
                    .put("contactsSyncedAt", contacts.opt("syncedAt"))
                    .put("archivedAt", archived > 0 ? archived : JSONObject.NULL)));
        } catch (Exception e) {
            fail(call, e);
        }
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
        try {
            int limit = Math.max(1, Math.min(2000, call.getData().optInt("limit", 500)));
            call.resolve(js(new JSONObject().put("threads", SmsStore.threads(context(), limit))));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void messages(PluginCall call) {
        try {
            JSObject data = call.getData();
            long thread = Long.parseLong(data.getString("threadId"));
            long before = data.has("before") && !data.isNull("before") ? data.getLong("before") : Long.MAX_VALUE;
            int limit = Math.max(1, Math.min(500, data.optInt("limit", 60)));
            call.resolve(js(SmsStore.messages(context(), thread, before, limit)));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void part(PluginCall call) {
        try {
            JSObject data = call.getData();
            call.resolve(js(SmsStore.part(context(), Long.parseLong(data.getString("partId")), Math.max(1, data.optInt("maxBytes", 26 * 1024 * 1024)))));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void search(PluginCall call) {
        try {
            String query = call.getData().optString("query", "").trim();
            int limit = Math.max(1, Math.min(500, call.getData().optInt("limit", 100)));
            call.resolve(js(new JSONObject().put("hits", query.isEmpty() ? new JSONArray() : SmsStore.search(context(), query, limit))));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void lookup(PluginCall call) {
        try {
            JSONArray numbers = call.getData().optJSONArray("numbers");
            call.resolve(js(new JSONObject().put("names", numbers == null ? new JSONObject() : SmsStore.names(context(), numbers))));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void markRead(PluginCall call) {
        try {
            long thread = Long.parseLong(call.getData().getString("threadId"));
            SmsStore.markRead(context(), thread);
            SmsNotices.cancel(context(), thread);
            call.resolve();
        } catch (Exception e) {
            fail(call, e);
        }
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
        try {
            JSObject out = new JSObject();
            out.put("removed", SmsStore.remove(context(), call.getData().getString("id")));
            call.resolve(out);
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void retryMms(PluginCall call) {
        try {
            JSObject out = new JSObject();
            out.put("started", MmsReceiver.retry(context(), call.getData().getString("id")));
            call.resolve(out);
        } catch (Exception e) {
            fail(call, e);
        }
    }

    /* -- Senden ----------------------------------------------------------------------------------- */

    @PluginMethod
    public void send(PluginCall call) {
        try {
            JSObject data = call.getData();
            JSONArray toArray = data.optJSONArray("to");
            List<String> to = new ArrayList<>();
            if (toArray != null) for (int i = 0; i < toArray.length(); i++) {
                String one = toArray.optString(i, "").trim();
                if (!one.isEmpty()) to.add(one);
            }
            String body = data.optString("body", "");
            if (to.isEmpty()) { call.reject("Brak odbiorcy."); return; }
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
                if (body.trim().isEmpty()) { call.reject("Pusta wiadomość."); return; }
                thread = -1;
                for (String one : to) thread = SmsSender.sendSms(context(), one, body, subId);
            }
            PhonePlugin.changed(thread);
            JSObject out = new JSObject();
            out.put("threadId", String.valueOf(thread));
            call.resolve(out);
        } catch (Exception e) {
            fail(call, e);
        }
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
        try {
            call.resolve(js(new JSONObject().put("contacts", PhoneContacts.read(context()))));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void writeContacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) { call.reject("Brak dostępu do kontaktów."); return; }
        try {
            JSONArray contacts = call.getData().optJSONArray("contacts");
            call.resolve(js(PhoneContacts.write(context(), contacts == null ? new JSONArray() : contacts)));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void contactsSoon(PluginCall call) {
        PhoneWork.contactsSoon(context());
        call.resolve();
    }

    /* -- Archiv ----------------------------------------------------------------------------------- */

    @PluginMethod
    public void exportMessages(PluginCall call) {
        try {
            JSObject data = call.getData();
            call.resolve(js(SmsStore.exportPage(context(), data.optLong("afterSms", 0), data.optLong("afterMms", 0),
                    Math.max(1, Math.min(1000, data.optInt("limit", 300))))));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void archiveMarkers(PluginCall call) {
        try {
            call.resolve(js(PhoneBridge.markers(context())));
        } catch (Exception e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void setArchiveMarkers(PluginCall call) {
        JSObject data = call.getData();
        PhoneBridge.setMarkers(context(), data.optLong("sms", 0), data.optLong("mms", 0), data.optLong("at", System.currentTimeMillis()));
        call.resolve();
    }
}
