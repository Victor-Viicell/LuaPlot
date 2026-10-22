const creditFormatter = new Intl.NumberFormat("en-US");

export function formatCredits(value: number): string {
  return creditFormatter.format(Math.round(value));
}

export function signedCredits(value: number): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}¥${creditFormatter.format(Math.abs(Math.round(value)))}`;
}

export function formatCreditRange(
  range: [number, number] | null,
  suffix = "",
): string {
  if (!range) {
    return "—";
  }

  const [min, max] = range;
  return min === max
    ? `¥${formatCredits(min)}${suffix}`
    : `¥${formatCredits(min)}–¥${formatCredits(max)}${suffix}`;
}

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}S`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function heatMeter(wanted: number): string {
  return "▰".repeat(wanted) + "▱".repeat(Math.max(0, 5 - wanted));
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatClock(secondOfDay: number, withSeconds = false): string {
  const total = ((Math.round(secondOfDay) % 86400) + 86400) % 86400;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const base = `${pad2(hours)}:${pad2(minutes)}`;
  return withSeconds ? `${base}:${pad2(seconds)}` : base;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  const parts: string[] = [];

  if (hours) {
    parts.push(`${hours}h`);
  }
  if (minutes) {
    parts.push(`${minutes}m`);
  }
  if (remaining || parts.length === 0) {
    parts.push(`${remaining}s`);
  }

  return parts.join(" ");
}

export function durationLabel(hours: number | undefined): string {
  if (!hours || hours <= 0) {
    return "0M";
  }

  if (hours < 1) {
    return `${Math.round(hours * 60)}M`;
  }

  return Number.isInteger(hours) ? `${hours}H` : `${hours.toFixed(1)}H`;
}

export function formatHourWindow(window?: [number, number]): string {
  if (!window || window[0] === window[1]) {
    return "24H";
  }

  return `${pad2(window[0])}:00–${pad2(window[1])}:00`;
}

export function energyLabel(energy: number | undefined): string {
  if (!energy) {
    return "";
  }

  return `${energy > 0 ? "+" : "−"}${Math.abs(energy)} EN`;
}

export function relationshipTone(relationship: number): string {
  if (relationship >= 80) {
    return "ride-or-die";
  }
  if (relationship >= 60) {
    return "close";
  }
  if (relationship >= 40) {
    return "friendly";
  }
  if (relationship >= 20) {
    return "acquainted";
  }
  return "cold";
}
