package pl.recreatio.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Die MMS-Kodierung, ohne Telefon: was wir schreiben, lesen wir; was ein Netz typischerweise schickt, auch. */
public class MmsPduTest {

    @Test
    public void aSendRequestReadsBack() {
        byte[] image = new byte[2000];
        for (int i = 0; i < image.length; i++) image[i] = (byte) (i * 7);
        List<MmsPdu.OutPart> parts = new ArrayList<>();
        parts.add(new MmsPdu.OutPart("application/smil", null, "<smil>", "smil.xml",
                MmsPdu.smil("image_0.jpg", "image/jpeg", "text_0.txt").getBytes(StandardCharsets.UTF_8), false));
        parts.add(new MmsPdu.OutPart("image/jpeg", "image_0.jpg", "<image_0>", "image_0.jpg", image, false));
        parts.add(new MmsPdu.OutPart("text/plain", null, "<text_0>", "text_0.txt", "Zażółć gęślą jaźń".getBytes(StandardCharsets.UTF_8), true));

        byte[] pdu = MmsPdu.sendReq(Arrays.asList("+48600100200", "601 601 601"), "Próba", parts, "T1234", 1_760_000_000L);
        MmsPdu.Message m = MmsPdu.parse(pdu);

        assertEquals(MmsPdu.SEND_REQ, m.type);
        assertEquals("T1234", m.transactionId);
        assertEquals(MmsPdu.VERSION_1_2, m.version);
        assertEquals(1_760_000_000L, m.date);
        assertNull("insert-address-token: no address of our own", m.from);
        assertEquals(Arrays.asList("+48600100200", "601601601"), m.to);
        assertEquals("Próba", m.subject);
        assertEquals("application/vnd.wap.multipart.related", m.contentType);
        assertEquals(3, m.parts.size());
        assertEquals("application/smil", m.parts.get(0).type);
        assertEquals("image/jpeg", m.parts.get(1).type);
        assertEquals("image_0.jpg", m.parts.get(1).name);
        assertEquals("<image_0>", m.parts.get(1).contentId);
        assertEquals("image_0.jpg", m.parts.get(1).contentLocation);
        assertArrayEquals(image, m.parts.get(1).data);
        assertEquals("text/plain", m.parts.get(2).type);
        assertEquals(106, m.parts.get(2).charset);
        assertEquals("Zażółć gęślą jaźń", m.parts.get(2).text());
        assertEquals("Zażółć gęślą jaźń", m.body());
    }

    @Test
    public void aNotifyResponseReadsBack() {
        MmsPdu.Message m = MmsPdu.parse(MmsPdu.notifyResp("ABC-1", MmsPdu.STATUS_RETRIEVED));
        assertEquals(MmsPdu.NOTIFYRESP_IND, m.type);
        assertEquals("ABC-1", m.transactionId);
        assertEquals(MmsPdu.STATUS_RETRIEVED, m.status);
    }

    @Test
    public void aNotificationAsANetworkSendsIt() {
        MmsPdu.Writer w = new MmsPdu.Writer();
        w.header(MmsPdu.MESSAGE_TYPE).octet(MmsPdu.NOTIFICATION_IND);
        w.header(MmsPdu.TRANSACTION_ID).text("T5f2a");
        w.header(MmsPdu.MMS_VERSION).octet(0x92);
        MmsPdu.Writer from = new MmsPdu.Writer();
        from.octet(0x80).text("+48600100200/TYPE=PLMN");
        w.header(MmsPdu.FROM).valueLength(from.size()).raw(from.toByteArray());
        w.header(MmsPdu.MESSAGE_CLASS).octet(0x80);
        w.header(MmsPdu.MESSAGE_SIZE).longInteger(41_234);
        MmsPdu.Writer expiry = new MmsPdu.Writer();
        expiry.octet(0x81).longInteger(604_800);
        w.header(MmsPdu.EXPIRY).valueLength(expiry.size()).raw(expiry.toByteArray());
        /* Ein Kopf, den wir nicht kennen (X-Mms-Reply-Charging, 0x1C): wird übersprungen. */
        w.octet(0x80 | 0x1C).octet(0x80);
        w.header(MmsPdu.CONTENT_LOCATION).text("http://mmsc.example.pl/mms?id=42");

        MmsPdu.Message m = MmsPdu.parse(w.toByteArray());
        assertEquals(MmsPdu.NOTIFICATION_IND, m.type);
        assertEquals("T5f2a", m.transactionId);
        assertEquals("+48600100200", m.from);
        assertEquals("personal", m.messageClass);
        assertEquals(41_234, m.size);
        assertTrue(m.expiryRelative);
        assertEquals(604_800, m.expiry);
        assertEquals("http://mmsc.example.pl/mms?id=42", m.contentLocation);
    }

    @Test
    public void aRetrievedGroupMessageWithShortCodes() {
        MmsPdu.Writer w = new MmsPdu.Writer();
        w.header(MmsPdu.MESSAGE_TYPE).octet(MmsPdu.RETRIEVE_CONF);
        w.header(MmsPdu.TRANSACTION_ID).text("T77");
        w.header(MmsPdu.MMS_VERSION).octet(0x92);
        w.header(MmsPdu.MESSAGE_ID).text("m-id-1");
        w.header(MmsPdu.DATE).longInteger(1_760_100_000L);
        MmsPdu.Writer from = new MmsPdu.Writer();
        from.octet(0x80).text("+48600100200/TYPE=PLMN");
        w.header(MmsPdu.FROM).valueLength(from.size()).raw(from.toByteArray());
        w.header(MmsPdu.TO).text("+48700700700/TYPE=PLMN");
        w.header(MmsPdu.CC).text("+48800800800/TYPE=PLMN");
        /* Betreff mit Zeichensatz (UTF-8, 0xEA). */
        w.header(MmsPdu.SUBJECT).encodedString("Święta");
        /* Content-Type: multipart.mixed als Kurzform (0xA3). */
        w.header(MmsPdu.CONTENT_TYPE).octet(0x80 | 0x23);
        w.uintvar(2);

        MmsPdu.Writer textType = new MmsPdu.Writer();
        textType.octet(0x80 | 0x03).octet(0x80 | 0x01).octet(0x80 | 106);
        MmsPdu.Writer textHead = new MmsPdu.Writer();
        textHead.valueLength(textType.size()).raw(textType.toByteArray());
        textHead.octet(0x80 | 0x0E).text("text.txt");
        byte[] text = "Wesołych Świąt!".getBytes(StandardCharsets.UTF_8);
        w.uintvar(textHead.size()).uintvar(text.length).raw(textHead.toByteArray()).raw(text);

        MmsPdu.Writer imageType = new MmsPdu.Writer();
        imageType.octet(0x80 | 0x1E).octet(0x80 | 0x05).text("choinka.jpg");
        MmsPdu.Writer imageHead = new MmsPdu.Writer();
        imageHead.valueLength(imageType.size()).raw(imageType.toByteArray());
        imageHead.octet(0x80 | 0x40).quoted("<choinka>");
        byte[] image = { (byte) 0xFF, (byte) 0xD8, 1, 2, 3, (byte) 0xFF, (byte) 0xD9 };
        w.uintvar(imageHead.size()).uintvar(image.length).raw(imageHead.toByteArray()).raw(image);

        MmsPdu.Message m = MmsPdu.parse(w.toByteArray());
        assertEquals(MmsPdu.RETRIEVE_CONF, m.type);
        assertEquals("m-id-1", m.messageId);
        assertEquals(1_760_100_000L, m.date);
        assertEquals("+48600100200", m.from);
        assertEquals(Arrays.asList("+48700700700"), m.to);
        assertEquals(Arrays.asList("+48800800800"), m.cc);
        assertEquals("Święta", m.subject);
        assertEquals("application/vnd.wap.multipart.mixed", m.contentType);
        assertEquals(2, m.parts.size());
        assertEquals("text/plain", m.parts.get(0).type);
        assertEquals("Wesołych Świąt!", m.parts.get(0).text());
        assertEquals("text.txt", m.parts.get(0).contentLocation);
        assertEquals("image/jpeg", m.parts.get(1).type);
        assertEquals("choinka.jpg", m.parts.get(1).name);
        assertEquals("<choinka>", m.parts.get(1).contentId);
        assertArrayEquals(image, m.parts.get(1).data);
        assertEquals("Wesołych Świąt!", m.body());
    }

    @Test
    public void numbersAsRecipients() {
        assertEquals("+48600100200/TYPE=PLMN", MmsPdu.addressOut("+48 600-100-200"));
        assertEquals("ania@example.pl", MmsPdu.addressOut("ania@example.pl"));
        assertEquals("+48600100200", MmsPdu.address("+48600100200/TYPE=PLMN"));
    }

    @Test
    public void polishLegacyCharsets() {
        assertEquals("ISO-8859-2", MmsPdu.charsetOf(5).name());
        assertEquals("UTF-8", MmsPdu.charsetOf(106).name());
        assertEquals("UTF-8", MmsPdu.charsetOf(9999).name());
    }
}
