package pl.recreatio.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/** Ein gehaltener Knopf (2026-10-21), ohne Telefon: bis wann gesendet wird. */
public class LampPressTest {

    @Test
    public void heldUntilReleasedButNeverLongerThanTheMaximum() {
        LampRadio.Press press = new LampRadio.Press();
        assertEquals("not started yet: no end", Long.MAX_VALUE, press.deadline());
        press.start(1_000);
        assertEquals("held: at most the maximum", 1_000 + LampRadio.Press.MAX_MS, press.deadline());
        press.release(1_800, 900);
        assertEquals("released: at once", 1_800, press.deadline());
        press.release(2_500, 1_600);
        assertEquals("the first release counts", 1_800, press.deadline());
    }

    @Test
    public void releasedBeforeTheRadioWasFreeSendsAsLongAsItWasPressed() {
        LampRadio.Press press = new LampRadio.Press();
        press.release(500, 1_200);
        press.start(3_000);
        assertEquals(4_200, press.deadline());

        LampRadio.Press brief = new LampRadio.Press();
        brief.release(0, 10);
        brief.start(0);
        assertEquals("never under the shortest frame", LampFrame.MIN_MS, brief.deadline());

        LampRadio.Press endless = new LampRadio.Press();
        endless.release(0, 999_999);
        endless.start(0);
        assertEquals("never over the maximum", LampRadio.Press.MAX_MS, endless.deadline());
    }
}
