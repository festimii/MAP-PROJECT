const numberFormatter = new Intl.NumberFormat("en-US");
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatNumber = (value: number): string => numberFormatter.format(value);

export const normalizeKey = (value: string): string => value.trim().toLowerCase();

export const formatDateTime = (value: string): string => {
  try {
    return dateTimeFormatter.format(new Date(value));
  } catch (error) {
    console.error("Failed to format date", error);
    return value;
  }
};
