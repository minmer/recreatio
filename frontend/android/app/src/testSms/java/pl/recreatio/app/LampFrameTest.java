package pl.recreatio.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

/** Die Ramka für die Lampe, ohne Telefon: was Android bekommt, ergibt wieder das mitgeschnittene Paket. */
public class LampFrameTest {

    private static final String CAPTURED = "1EFF00000048464B4AE15A2285B8F21CB0424734F03133C519101112131415";

    @Test
    public void theCapturedPacketComesBackByteForByte() {
        /* Die Seite gibt Kennung 0x0000 und die 27 Bytes NACH der Kennung (ab Byte 5). */
        LampFrame frame = LampFrame.of(0x0000, CAPTURED.substring(8), 1000, 0);
        assertEquals(27, frame.data.length);
        assertArrayEquals(LampFrame.bytes(CAPTURED), frame.air());
        assertEquals(31, frame.air().length);
        assertEquals(CAPTURED, LampFrame.hex(frame.air()));
    }

    @Test
    public void theIdIsLittleEndian() {
        byte[] air = LampFrame.of(0x1234, "AB", 1000, 0).air();
        assertArrayEquals(new byte[] { 0x04, (byte) 0xFF, 0x34, 0x12, (byte) 0xAB }, air);
    }

    @Test
    public void hexInAnyCase() {
        assertArrayEquals(new byte[] { 0x0A, (byte) 0xBC }, LampFrame.bytes("0abC"));
        assertEquals("0ABC", LampFrame.hex(new byte[] { 0x0A, (byte) 0xBC }));
    }

    @Test
    public void tooMuchOrBrokenIsRefused() {
        refused(0x0000, CAPTURED.substring(6), 1000, 0, "28 bytes after the id do not fit");
        refused(0x10000, "00", 1000, 0, "id above 0xFFFF");
        refused(-1, "00", 1000, 0, "negative id");
        refused(0, "ABC", 1000, 0, "odd number of digits");
        refused(0, "ZZ", 1000, 0, "not hex");
        refused(0, "00", 99, 0, "shorter than 100 ms");
        refused(0, "00", 30_001, 0, "longer than 30 s");
        refused(0, "00", 1000, -1, "negative gap");
        refused(0, "00", 1000, 10_001, "gap above 10 s");
    }

    @Test
    public void emptyDataIsJustTheId() {
        assertArrayEquals(new byte[] { 0x03, (byte) 0xFF, 0x00, 0x00 }, LampFrame.of(0, "", 100, 0).air());
    }

    private static void refused(int id, String hex, long duration, long gap, String why) {
        try {
            LampFrame.of(id, hex, duration, gap);
            fail(why);
        } catch (IllegalArgumentException e) {
            assertTrue(why, e.getMessage() != null && !e.getMessage().isEmpty());
        }
    }
}
