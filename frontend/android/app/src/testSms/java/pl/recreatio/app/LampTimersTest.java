package pl.recreatio.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Calendar;
import java.util.TimeZone;

/** Wann ein Timer der Lampen das nächste Mal dran ist — ohne Telefon, in Warschauer Zeit. */
public class LampTimersTest {

    private static final TimeZone WARSAW = TimeZone.getTimeZone("Europe/Warsaw");

    private static long at(int year, int month, int day, int hour, int minute) {
        Calendar cal = Calendar.getInstance(WARSAW);
        cal.clear();
        cal.set(year, month - 1, day, hour, minute, 0);
        return cal.getTimeInMillis();
    }

    private static final int MON = 1, TUE = 1 << 1, SAT = 1 << 5, SUN = 1 << 6;

    @Test
    public void laterTodayOrTomorrow() {
        long sunday = at(2026, 10, 18, 4, 30);
        assertEquals(at(2026, 10, 18, 7, 0), LampTimers.next(sunday, WARSAW, 7 * 60, 0));
        assertEquals("exactly now is already past", at(2026, 10, 19, 4, 30), LampTimers.next(sunday, WARSAW, 4 * 60 + 30, 0));
        assertEquals(at(2026, 10, 19, 0, 0), LampTimers.next(sunday, WARSAW, 0, 0));
    }

    @Test
    public void onlyOnChosenDays() {
        long sunday = at(2026, 10, 18, 22, 0);
        assertEquals("Monday", at(2026, 10, 19, 7, 0), LampTimers.next(sunday, WARSAW, 7 * 60, MON));
        assertEquals("Tuesday", at(2026, 10, 20, 7, 0), LampTimers.next(sunday, WARSAW, 7 * 60, TUE));
        assertEquals("next Saturday", at(2026, 10, 24, 9, 0), LampTimers.next(sunday, WARSAW, 9 * 60, SAT));
        assertEquals("Sunday, a week later", at(2026, 10, 25, 21, 0), LampTimers.next(sunday, WARSAW, 21 * 60, SUN));
        assertEquals("Sunday, still today", at(2026, 10, 18, 23, 0), LampTimers.next(sunday, WARSAW, 23 * 60, SUN));
    }

    @Test
    public void acrossTheClockChange() {
        /* 2026-10-25: 03:00 → 02:00 in Poland. 07:00 is still 07:00 local time. */
        long saturday = at(2026, 10, 24, 20, 0);
        long sunday7 = LampTimers.next(at(2026, 10, 25, 0, 30), WARSAW, 7 * 60, 0);
        Calendar cal = Calendar.getInstance(WARSAW);
        cal.setTimeInMillis(sunday7);
        assertEquals(7, cal.get(Calendar.HOUR_OF_DAY));
        assertEquals(25, cal.get(Calendar.DAY_OF_MONTH));
        assertEquals(at(2026, 10, 25, 7, 0), LampTimers.next(saturday, WARSAW, 7 * 60, SUN));
    }

    @Test
    public void daysAndNonsense() {
        Calendar cal = Calendar.getInstance(WARSAW);
        cal.setTimeInMillis(at(2026, 10, 19, 12, 0));
        assertEquals("Monday is 1", 1, LampTimers.isoDay(cal));
        cal.setTimeInMillis(at(2026, 10, 18, 12, 0));
        assertEquals("Sunday is 7", 7, LampTimers.isoDay(cal));
        assertTrue(LampTimers.dayFits(0, 3));
        assertTrue(LampTimers.dayFits(MON | SUN, 7));
        assertFalse(LampTimers.dayFits(MON | SUN, 2));
        assertEquals(-1, LampTimers.next(0, WARSAW, 24 * 60, 0));
        assertEquals(-1, LampTimers.next(0, WARSAW, -1, 0));
    }
}
