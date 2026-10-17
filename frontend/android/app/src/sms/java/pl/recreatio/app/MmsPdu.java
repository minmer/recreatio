package pl.recreatio.app;

import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * MMS ALS BYTES (OMA MMS Encapsulation 1.2/1.3 in WSP-Kodierung) — gelesen und
 * geschrieben, soweit eine SMS-App es braucht:
 *
 * <code>
 *   lesen     m-notification-ind (es liegt eine MMS bereit), m-retrieve-conf
 *             (die geladene MMS mit ihren Teilen), m-send-conf, m-delivery-ind
 *   schreiben m-send-req (eine MMS hinaus), m-notifyresp-ind (geladen)
 * </code>
 *
 * <p><b>Was unbekannt ist, wird übersprungen, nicht abgelehnt.</b> Jeder
 * Netzbetreiber setzt andere Köpfe; ein Wert lässt sich am ersten Byte
 * vermessen (Länge, Text bis NUL, ein einzelnes Byte), und so kommt man auch
 * über einen Kopf hinweg, den man nicht kennt.</p>
 *
 * <p>Ohne Android — damit es sich auf dem Rechner prüfen lässt ({@code src/testSms}).</p>
 */
final class MmsPdu {

    /* -- Nachrichtenarten ------------------------------------------------------------------- */

    static final int SEND_REQ = 0x80;
    static final int SEND_CONF = 0x81;
    static final int NOTIFICATION_IND = 0x82;
    static final int NOTIFYRESP_IND = 0x83;
    static final int RETRIEVE_CONF = 0x84;
    static final int ACKNOWLEDGE_IND = 0x85;
    static final int DELIVERY_IND = 0x86;
    static final int READ_REC_IND = 0x87;
    static final int READ_ORIG_IND = 0x88;

    /** m-notifyresp-ind: „geladen". */
    static final int STATUS_RETRIEVED = 0x81;
    static final int STATUS_DEFERRED = 0x83;

    /* -- Köpfe (ohne das hohe Bit) --------------------------------------------------------- */

    static final int BCC = 0x01;
    static final int CC = 0x02;
    static final int CONTENT_LOCATION = 0x03;
    static final int CONTENT_TYPE = 0x04;
    static final int DATE = 0x05;
    static final int DELIVERY_REPORT = 0x06;
    static final int EXPIRY = 0x08;
    static final int FROM = 0x09;
    static final int MESSAGE_CLASS = 0x0A;
    static final int MESSAGE_ID = 0x0B;
    static final int MESSAGE_TYPE = 0x0C;
    static final int MMS_VERSION = 0x0D;
    static final int MESSAGE_SIZE = 0x0E;
    static final int PRIORITY = 0x0F;
    static final int READ_REPORT = 0x10;
    static final int RESPONSE_STATUS = 0x12;
    static final int RESPONSE_TEXT = 0x13;
    static final int STATUS = 0x15;
    static final int SUBJECT = 0x16;
    static final int TO = 0x17;
    static final int TRANSACTION_ID = 0x18;
    static final int RETRIEVE_STATUS = 0x19;
    static final int RETRIEVE_TEXT = 0x1A;

    /** MMS 1.2 — Hauptversion 1, Nebenversion 2. */
    static final int VERSION_1_2 = 0x92;

    private MmsPdu() {
    }

    /* -- Was herauskommt ------------------------------------------------------------------- */

    static final class Part {
        String type = "application/octet-stream";
        int charset;
        String name;
        String filename;
        String contentId;
        String contentLocation;
        byte[] data = new byte[0];

        boolean isText() {
            return type.startsWith("text/") && !type.equals("text/x-vcard") && !type.equals("text/x-vcalendar");
        }

        boolean isSmil() {
            return type.equals("application/smil");
        }

        /** Der Text eines Textteils, in seinem Zeichensatz. */
        String text() {
            return new String(data, charsetOf(charset));
        }

        String fileName() {
            if (filename != null && !filename.isEmpty()) return filename;
            if (name != null && !name.isEmpty()) return name;
            if (contentLocation != null && !contentLocation.isEmpty()) return contentLocation;
            return null;
        }
    }

    static final class Message {
        int type;
        String transactionId;
        String messageId;
        int version = VERSION_1_2;
        /** Sekunden — wie in der MMS selbst und in der Tabelle des Telefons. */
        long date;
        String from;
        final List<String> to = new ArrayList<>();
        final List<String> cc = new ArrayList<>();
        String subject;
        String contentLocation;
        long size;
        /** Sekunden: absolut, oder relativ (dann {@code expiryRelative}). */
        long expiry;
        boolean expiryRelative;
        String messageClass;
        int status;
        int responseStatus;
        int retrieveStatus;
        int priority;
        String contentType;
        final List<Part> parts = new ArrayList<>();

        /** Der ganze Text — alle Textteile hintereinander. */
        String body() {
            StringBuilder out = new StringBuilder();
            for (Part p : parts) {
                if (!p.isText()) continue;
                if (out.length() > 0) out.append('\n');
                out.append(p.text());
            }
            return out.toString();
        }
    }

    /* -- Lesen ----------------------------------------------------------------------------- */

    static Message parse(byte[] pdu) {
        Reader in = new Reader(pdu);
        Message m = new Message();
        boolean typed = false;
        while (in.has()) {
            int field = in.peek();
            if ((field & 0x80) == 0) {
                /* Ein Kopf mit Namen statt Nummer (X-…): Name und Wert überspringen. */
                in.text();
                in.skipValue();
                continue;
            }
            in.next();
            switch (field & 0x7F) {
                case MESSAGE_TYPE: m.type = in.next(); typed = true; break;
                case TRANSACTION_ID: m.transactionId = in.text(); break;
                case MMS_VERSION: m.version = in.next(); break;
                case MESSAGE_ID: m.messageId = in.text(); break;
                case DATE: m.date = in.longInteger(); break;
                case FROM: m.from = in.from(); break;
                case TO: m.to.add(address(in.encodedString())); break;
                case CC: m.cc.add(address(in.encodedString())); break;
                case BCC: in.encodedString(); break;
                case SUBJECT: m.subject = in.encodedString(); break;
                case CONTENT_LOCATION: m.contentLocation = in.text(); break;
                case MESSAGE_SIZE: m.size = in.longInteger(); break;
                case EXPIRY: in.expiry(m); break;
                case MESSAGE_CLASS: m.messageClass = in.messageClass(); break;
                case STATUS: m.status = in.next(); break;
                case RESPONSE_STATUS: m.responseStatus = in.next(); break;
                case RETRIEVE_STATUS: m.retrieveStatus = in.next(); break;
                case PRIORITY: m.priority = in.next(); break;
                case CONTENT_TYPE: {
                    /* Der letzte Kopf: danach kommt der Körper. */
                    ContentType type = in.contentType();
                    m.contentType = type.type;
                    m.parts.addAll(in.body(type));
                    if (!typed) throw new IllegalArgumentException("MMS without a message type");
                    return m;
                }
                default: in.skipValue(); break;
            }
        }
        if (!typed) throw new IllegalArgumentException("MMS without a message type");
        return m;
    }

    /** „+48600100200/TYPE=PLMN" → „+48600100200". */
    static String address(String raw) {
        if (raw == null) return null;
        String text = raw.trim();
        int slash = text.indexOf("/TYPE=");
        if (slash < 0) slash = text.indexOf("/type=");
        return slash < 0 ? text : text.substring(0, slash);
    }

    /** Der Zeichensatz zu einer MIBenum-Nummer — Unbekanntes als UTF-8. */
    static Charset charsetOf(int mib) {
        String name;
        switch (mib) {
            case 3: name = "US-ASCII"; break;
            case 4: name = "ISO-8859-1"; break;
            case 5: name = "ISO-8859-2"; break;
            case 6: name = "ISO-8859-3"; break;
            case 7: name = "ISO-8859-4"; break;
            case 8: name = "ISO-8859-5"; break;
            case 17: name = "Shift_JIS"; break;
            case 113: name = "GBK"; break;
            case 1000:
            case 1013: name = "UTF-16BE"; break;
            case 1014: name = "UTF-16LE"; break;
            case 1015: name = "UTF-16"; break;
            case 2025: name = "GB2312"; break;
            case 2026: name = "Big5"; break;
            case 2250: name = "windows-1250"; break;
            case 2252: name = "windows-1252"; break;
            default: return StandardCharsets.UTF_8;
        }
        try {
            return Charset.forName(name);
        } catch (Exception e) {
            return StandardCharsets.UTF_8;
        }
    }

    static int mibOf(String name) {
        String n = name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
        switch (n) {
            case "us-ascii": return 3;
            case "iso-8859-1": return 4;
            case "iso-8859-2": return 5;
            case "utf-16be":
            case "iso-10646-ucs-2": return 1000;
            case "utf-16le": return 1014;
            case "utf-16": return 1015;
            case "windows-1250": return 2250;
            case "windows-1252": return 2252;
            default: return 106;
        }
    }

    /** Die bekannten Medientypen der WSP (Content-Type, Kurzform). */
    private static final String[] MEDIA = {
        "*/*", "text/*", "text/html", "text/plain", "text/x-hdml", "text/x-ttml", "text/x-vcalendar", "text/x-vcard",
        "text/vnd.wap.wml", "text/vnd.wap.wmlscript", "text/vnd.wap.wta-event", "multipart/*", "multipart/mixed",
        "multipart/form-data", "multipart/byterantes", "multipart/alternative", "application/*", "application/java-vm",
        "application/x-www-form-urlencoded", "application/x-hdmlc", "application/vnd.wap.wmlc",
        "application/vnd.wap.wmlscriptc", "application/vnd.wap.wta-eventc", "application/vnd.wap.uaprof",
        "application/vnd.wap.wtls-ca-certificate", "application/vnd.wap.wtls-user-certificate",
        "application/x-x509-ca-cert", "application/x-x509-user-cert", "image/*", "image/gif", "image/jpeg", "image/tiff",
        "image/png", "image/vnd.wap.wbmp", "application/vnd.wap.multipart.*", "application/vnd.wap.multipart.mixed",
        "application/vnd.wap.multipart.form-data", "application/vnd.wap.multipart.byteranges",
        "application/vnd.wap.multipart.alternative", "application/xml", "text/xml", "application/vnd.wap.wbxml",
        "application/x-x968-cross-cert", "application/x-x968-ca-cert", "application/x-x968-user-cert",
        "text/vnd.wap.si", "application/vnd.wap.sic", "text/vnd.wap.sl", "application/vnd.wap.slc", "text/vnd.wap.co",
        "application/vnd.wap.coc", "application/vnd.wap.multipart.related", "application/vnd.wap.sia",
        "text/vnd.wap.connectivity-xml", "application/vnd.wap.connectivity-wbxml", "application/pkcs7-mime",
        "application/vnd.wap.hashed-certificate", "application/vnd.wap.signed-certificate",
        "application/vnd.wap.cert-response", "application/xhtml+xml", "application/wml+xml", "text/css",
        "application/vnd.wap.mms-message", "application/vnd.wap.rollover-certificate", "application/vnd.wap.locc+wbxml",
        "application/vnd.wap.loc+xml", "application/vnd.syncml.dm+wbxml", "application/vnd.syncml.dm+xml",
        "application/vnd.syncml.notification", "application/vnd.wap.xhtml+xml", "application/vnd.wv.csp.cir",
        "application/vnd.oma.dd+xml", "application/vnd.oma.drm.message", "application/vnd.oma.drm.content",
        "application/vnd.oma.drm.rights+xml", "application/vnd.oma.drm.rights+wbxml", "application/vnd.wv.csp+xml",
        "application/vnd.wv.csp+wbxml", "application/vnd.syncml.ds.notification", "audio/*", "video/*",
        "application/vnd.oma.dd2+xml", "application/mikey"
    };

    static String media(int code) {
        return code >= 0 && code < MEDIA.length ? MEDIA[code] : "application/octet-stream";
    }

    static boolean multipart(String type) {
        return type != null && (type.startsWith("application/vnd.wap.multipart") || type.startsWith("multipart/"));
    }

    static final class ContentType {
        String type = "application/octet-stream";
        int charset;
        String name;
        String filename;
        String start;
        String related;
    }

    /** Der Leser: eine Stelle in den Bytes und die Grundformen der WSP-Kodierung. */
    static final class Reader {
        private final byte[] b;
        private int at;

        Reader(byte[] bytes) {
            this.b = bytes;
        }

        boolean has() {
            return at < b.length;
        }

        int peek() {
            if (at >= b.length) throw new IllegalArgumentException("MMS ends early");
            return b[at] & 0xFF;
        }

        int next() {
            int v = peek();
            at++;
            return v;
        }

        byte[] bytes(int n) {
            if (n < 0 || at + n > b.length) throw new IllegalArgumentException("MMS ends early");
            byte[] out = new byte[n];
            System.arraycopy(b, at, out, 0, n);
            at += n;
            return out;
        }

        long uintvar() {
            long v = 0;
            for (int i = 0; i < 5; i++) {
                int c = next();
                v = (v << 7) | (c & 0x7F);
                if ((c & 0x80) == 0) return v;
            }
            throw new IllegalArgumentException("uintvar too long");
        }

        /** Value-length: 0–30 in einem Byte, sonst 31 und ein uintvar. */
        int valueLength() {
            int c = next();
            if (c < 31) return c;
            if (c == 31) return (int) uintvar();
            throw new IllegalArgumentException("not a value length");
        }

        /** Text bis NUL — ein führendes 0x7F (Quote) gehört nicht dazu, ein Anführungszeichen (0x22) auch nicht. */
        String text() {
            if (has() && (peek() == 0x7F || peek() == 0x22)) at++;
            int start = at;
            while (at < b.length && b[at] != 0) at++;
            String s = new String(b, start, at - start, StandardCharsets.UTF_8);
            if (at < b.length) at++;
            return s;
        }

        long longInteger() {
            int length = next();
            if (length > 8) throw new IllegalArgumentException("long integer too long");
            long v = 0;
            for (int i = 0; i < length; i++) v = (v << 8) | next();
            return v;
        }

        /** Short-integer (ein Byte mit hohem Bit) oder Long-integer. */
        long integer() {
            int c = peek();
            if ((c & 0x80) != 0) return next() & 0x7F;
            return longInteger();
        }

        /** Text, oder Länge + Zeichensatz + Text. */
        String encodedString() {
            int c = peek();
            if (c <= 31) {
                int length = valueLength();
                int end = at + length;
                int charset = (int) integer();
                int start = at;
                int stop = start;
                while (stop < end && b[stop] != 0) stop++;
                if (start < end && (b[start] & 0xFF) == 0x7F) start++;
                String s = new String(b, start, Math.max(0, stop - start), charsetOf(charset));
                at = end;
                return s;
            }
            return text();
        }

        /** From: Länge, dann „Adresse folgt" (0x80) mit Adresse — oder „setz meine ein" (0x81). */
        String from() {
            int length = valueLength();
            int end = at + length;
            String out = null;
            if (at < end && next() == 0x80 && at < end) out = address(encodedString());
            at = end;
            return out;
        }

        void expiry(Message m) {
            int length = valueLength();
            int end = at + length;
            if (at < end) {
                int token = next();
                m.expiryRelative = token == 0x81;
                if (at < end) m.expiry = integer();
            }
            at = end;
        }

        String messageClass() {
            int c = peek();
            if ((c & 0x80) != 0) {
                next();
                switch (c) {
                    case 0x80: return "personal";
                    case 0x81: return "advertisement";
                    case 0x82: return "informational";
                    case 0x83: return "auto";
                    default: return "personal";
                }
            }
            return text();
        }

        /** Einen Wert überspringen, den man nicht kennt — am ersten Byte vermessen. */
        void skipValue() {
            int c = peek();
            if (c <= 30) { at += 1 + c; return; }
            if (c == 31) { at++; int length = (int) uintvar(); at += length; return; }
            if (c < 0x80) { text(); return; }
            at++;
        }

        ContentType contentType() {
            ContentType ct = new ContentType();
            int c = peek();
            if ((c & 0x80) != 0) { next(); ct.type = media(c & 0x7F); return ct; }
            if (c >= 0x20) { ct.type = text().toLowerCase(Locale.ROOT); return ct; }
            int length = valueLength();
            int end = at + length;
            c = peek();
            if ((c & 0x80) != 0) { next(); ct.type = media(c & 0x7F); }
            else if (c >= 0x20) ct.type = text().toLowerCase(Locale.ROOT);
            else ct.type = media((int) longInteger());
            parameters(ct, end);
            at = end;
            return ct;
        }

        private void parameters(ContentType ct, int end) {
            while (at < end) {
                int c = peek();
                if ((c & 0x80) != 0) {
                    next();
                    switch (c & 0x7F) {
                        case 0x01: ct.charset = (int) integer(); break;
                        case 0x09: ct.related = constrained(); break;
                        case 0x0A:
                        case 0x19: ct.start = text(); break;
                        case 0x05:
                        case 0x17: ct.name = text(); break;
                        case 0x06:
                        case 0x18: ct.filename = text(); break;
                        default: skipValue(); break;
                    }
                } else if (c >= 0x20) {
                    String name = text().toLowerCase(Locale.ROOT);
                    String value = textOrNull();
                    if (value == null) continue;
                    switch (name) {
                        case "charset": ct.charset = mibOf(value); break;
                        case "name": ct.name = value; break;
                        case "filename": ct.filename = value; break;
                        case "start": ct.start = value; break;
                        case "type": ct.related = value; break;
                        default: break;
                    }
                } else {
                    skipValue();
                }
            }
        }

        private String textOrNull() {
            int c = peek();
            if (c >= 0x20 && c < 0x80) return text();
            skipValue();
            return null;
        }

        private String constrained() {
            int c = peek();
            if ((c & 0x80) != 0) { next(); return media(c & 0x7F); }
            return text();
        }

        /** Der Körper: mehrteilig (je Teil Kopf, Typ, Daten) — oder ein einziger Teil. */
        List<Part> body(ContentType type) {
            List<Part> parts = new ArrayList<>();
            if (!multipart(type.type)) {
                Part p = new Part();
                p.type = type.type;
                p.charset = type.charset;
                p.name = type.name;
                p.data = bytes(b.length - at);
                parts.add(p);
                return parts;
            }
            if (!has()) return parts;
            multipartBody(parts);
            return parts;
        }

        void multipartBody(List<Part> parts) {
            long count = uintvar();
            for (long i = 0; i < count && has(); i++) {
                int headersLength = (int) uintvar();
                int dataLength = (int) uintvar();
                int headersEnd = at + headersLength;
                ContentType ct = contentType();
                Part p = new Part();
                p.type = ct.type;
                p.charset = ct.charset;
                p.name = ct.name;
                p.filename = ct.filename;
                partHeaders(p, headersEnd);
                at = headersEnd;
                p.data = bytes(dataLength);
                if (multipart(p.type)) {
                    /* Eine Mehrteilige in der Mehrteiligen (multipart/alternative): ihre Teile flach dazu. */
                    try {
                        new Reader(p.data).multipartBody(parts);
                    } catch (IllegalArgumentException ignored) {
                        // Dann eben ohne sie.
                    }
                } else {
                    parts.add(p);
                }
            }
        }

        private void partHeaders(Part p, int end) {
            while (at < end) {
                int c = peek();
                if ((c & 0x80) != 0) {
                    next();
                    switch (c & 0x7F) {
                        case 0x0E: p.contentLocation = text(); break;
                        case 0x40: p.contentId = text(); break;
                        case 0x2E:
                        case 0x45: disposition(p); break;
                        default: skipValue(); break;
                    }
                } else if (c >= 0x20) {
                    String name = text().toLowerCase(Locale.ROOT);
                    String value = textOrNull();
                    if (value == null) continue;
                    if (name.equals("content-location")) p.contentLocation = value;
                    else if (name.equals("content-id")) p.contentId = value;
                } else {
                    skipValue();
                }
            }
        }

        private void disposition(Part p) {
            int length = valueLength();
            int end = at + length;
            if (at < end) {
                int c = peek();
                if ((c & 0x80) != 0) next(); else text();
            }
            while (at < end) {
                int c = peek();
                if ((c & 0x80) != 0) {
                    next();
                    int token = c & 0x7F;
                    if (token == 0x06 || token == 0x18) p.filename = text();
                    else if (token == 0x05 || token == 0x17) { String n = text(); if (p.name == null) p.name = n; }
                    else skipValue();
                } else if (c >= 0x20) {
                    String name = text().toLowerCase(Locale.ROOT);
                    String value = textOrNull();
                    if (value != null && name.equals("filename")) p.filename = value;
                } else {
                    skipValue();
                }
            }
            at = end;
        }
    }

    /* -- Schreiben ------------------------------------------------------------------------- */

    /** Ein Teil, der hinausgeht. */
    static final class OutPart {
        final String type;
        final String name;
        final String contentId;
        final String contentLocation;
        final byte[] data;
        final boolean text;

        OutPart(String type, String name, String contentId, String contentLocation, byte[] data, boolean text) {
            this.type = type;
            this.name = name;
            this.contentId = contentId;
            this.contentLocation = contentLocation;
            this.data = data;
            this.text = text;
        }
    }

    /** „Geladen" — damit der Server der MMS sie als zugestellt führt. */
    static byte[] notifyResp(String transactionId, int status) {
        Writer w = new Writer();
        w.header(MESSAGE_TYPE).octet(NOTIFYRESP_IND);
        w.header(TRANSACTION_ID).text(transactionId == null ? "" : transactionId);
        w.header(MMS_VERSION).octet(VERSION_1_2);
        w.header(STATUS).octet(status);
        return w.toByteArray();
    }

    /**
     * EINE MMS HINAUS: an alle {@code to}, mit den Teilen (die SMIL zuerst). Die
     * eigene Nummer setzt das Netz ein (Insert-address-token).
     */
    static byte[] sendReq(List<String> to, String subject, List<OutPart> parts, String transactionId, long dateSeconds) {
        Writer w = new Writer();
        w.header(MESSAGE_TYPE).octet(SEND_REQ);
        w.header(TRANSACTION_ID).text(transactionId);
        w.header(MMS_VERSION).octet(VERSION_1_2);
        w.header(DATE).longInteger(dateSeconds);
        w.header(FROM).valueLength(1).octet(0x81);
        for (String one : to) w.header(TO).encodedString(addressOut(one));
        if (subject != null && !subject.isEmpty()) w.header(SUBJECT).encodedString(subject);
        w.header(MESSAGE_CLASS).octet(0x80);
        w.header(PRIORITY).octet(0x81);
        w.header(DELIVERY_REPORT).octet(0x81);
        w.header(READ_REPORT).octet(0x81);

        Writer type = new Writer();
        type.octet(0x80 | 0x33);
        type.octet(0x80 | 0x09).text("application/smil");
        type.octet(0x80 | 0x0A).text("<smil>");
        w.header(CONTENT_TYPE).valueLength(type.size()).raw(type.toByteArray());

        w.uintvar(parts.size());
        for (OutPart p : parts) {
            Writer media = new Writer();
            media.text(p.type);
            if (p.text) media.octet(0x80 | 0x01).octet(0x80 | 106);
            if (p.name != null) media.octet(0x80 | 0x05).text(p.name);

            Writer head = new Writer();
            head.valueLength(media.size()).raw(media.toByteArray());
            head.octet(0x80 | 0x40).quoted(p.contentId);
            head.octet(0x80 | 0x0E).text(p.contentLocation);

            w.uintvar(head.size()).uintvar(p.data.length).raw(head.toByteArray()).raw(p.data);
        }
        return w.toByteArray();
    }

    /** Eine Nummer als Empfänger („/TYPE=PLMN"), eine E-Mail-Adresse, wie sie ist. */
    static String addressOut(String raw) {
        String a = raw.trim();
        if (a.contains("@")) return a;
        StringBuilder digits = new StringBuilder();
        for (char c : a.toCharArray()) if (Character.isDigit(c) || (c == '+' && digits.length() == 0)) digits.append(c);
        return digits + "/TYPE=PLMN";
    }

    /** Die SMIL, die Bild und Text nebeneinanderlegt — Telefone ohne sie zeigen manchmal nichts. */
    static String smil(String imageLocation, String imageType, String textLocation) {
        StringBuilder body = new StringBuilder("<par dur=\"5000ms\">");
        if (imageLocation != null) {
            String tag = imageType != null && imageType.startsWith("video/") ? "video" : imageType != null && imageType.startsWith("audio/") ? "audio" : "img";
            body.append('<').append(tag).append(" src=\"").append(imageLocation).append("\" region=\"Image\"/>");
        }
        if (textLocation != null) body.append("<text src=\"").append(textLocation).append("\" region=\"Text\"/>");
        body.append("</par>");
        return "<smil><head><layout><root-layout/>"
                + "<region id=\"Image\" fit=\"meet\" top=\"0\" left=\"0\" height=\"80%\" width=\"100%\"/>"
                + "<region id=\"Text\" top=\"80%\" left=\"0\" height=\"20%\" width=\"100%\" fit=\"scroll\"/>"
                + "</layout></head><body>" + body + "</body></smil>";
    }

    static final class Writer {
        private final ByteArrayOutputStream out = new ByteArrayOutputStream();

        Writer header(int field) {
            out.write(0x80 | field);
            return this;
        }

        Writer octet(int v) {
            out.write(v & 0xFF);
            return this;
        }

        Writer raw(byte[] bytes) {
            out.write(bytes, 0, bytes.length);
            return this;
        }

        Writer text(String s) {
            byte[] bytes = s.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > 0 && (bytes[0] & 0x80) != 0) out.write(0x7F);
            out.write(bytes, 0, bytes.length);
            out.write(0);
            return this;
        }

        Writer quoted(String s) {
            out.write(0x22);
            byte[] bytes = s.getBytes(StandardCharsets.UTF_8);
            out.write(bytes, 0, bytes.length);
            out.write(0);
            return this;
        }

        Writer uintvar(long v) {
            int groups = 1;
            for (long rest = v >>> 7; rest != 0; rest >>>= 7) groups++;
            for (int i = groups - 1; i >= 0; i--) {
                int c = (int) ((v >>> (7 * i)) & 0x7F);
                out.write(i == 0 ? c : (c | 0x80));
            }
            return this;
        }

        Writer valueLength(int length) {
            if (length < 31) out.write(length);
            else { out.write(31); uintvar(length); }
            return this;
        }

        Writer longInteger(long v) {
            int length = 1;
            for (long rest = v >>> 8; rest != 0; rest >>>= 8) length++;
            out.write(length);
            for (int i = length - 1; i >= 0; i--) out.write((int) ((v >>> (8 * i)) & 0xFF));
            return this;
        }

        /** Reiner ASCII-Text wie er ist, alles andere mit dem Zeichensatz UTF-8 davor. */
        Writer encodedString(String s) {
            boolean ascii = true;
            for (int i = 0; i < s.length(); i++) if (s.charAt(i) >= 0x80) { ascii = false; break; }
            if (ascii) return text(s);
            Writer inner = new Writer();
            inner.octet(0x80 | 106).text(s);
            valueLength(inner.size());
            return raw(inner.toByteArray());
        }

        int size() {
            return out.size();
        }

        byte[] toByteArray() {
            return out.toByteArray();
        }
    }
}
