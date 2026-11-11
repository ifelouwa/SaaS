/**
 * Pure date/time utility functions safe for both client and server components.
 */

export function formatMinuteToDisplay(minute: number): string {
  const hours24 = Math.floor(minute / 60);
  const mins = minute % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minsFormatted = mins < 10 ? `0${mins}` : `${mins}`;
  return `${hours12}:${minsFormatted} ${period}`;
}

export function formatMinuteTo24Hour(minute: number): string {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  const hoursFormatted = hours < 10 ? `0${hours}` : `${hours}`;
  const minsFormatted = mins < 10 ? `0${mins}` : `${mins}`;
  return `${hoursFormatted}:${minsFormatted}`;
}

export function timeStringToMinute(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  return (isNaN(hours) ? 0 : hours) * 60 + (isNaN(mins) ? 0 : mins);
}

export function getDayOfWeekFromDateString(dateStr: string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
} {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return {
    year,
    month,
    day,
    dayOfWeek: utcDate.getUTCDay(),
  };
}
