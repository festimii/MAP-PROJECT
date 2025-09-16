export const numberFormatter = new Intl.NumberFormat("en-US");

export const formatNumber = (value: number) => numberFormatter.format(value);

export const normalizeKey = (value: string) => value.trim().toLowerCase();

export const sortByStoreCount = <T extends { storeCount: number; name: string }>(
  list: T[]
) =>
  list
    .slice()
    .sort((a, b) => b.storeCount - a.storeCount || a.name.localeCompare(b.name));
