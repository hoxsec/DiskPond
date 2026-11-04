// Owner-supplied commercial details. Prices are integer euro cents, VAT included.
export const site = {
  url: "https://diskpond.com",
  repository: "https://github.com/hoxsec/DiskPond",
  salesEmail: "sales@diskpond.com",
  supportEmail: "support@diskpond.com",
  download:
    "https://github.com/hoxsec/DiskPond/releases/latest/download/DiskPond-Windows.exe",
  releases: "https://github.com/hoxsec/DiskPond/releases/latest",
  cloud: {
    capacityGb: 500,
    monthlyCents: 500,
    yearlyDiscountPercent: 25,
  },
};

type BillingPeriod = "monthly" | "yearly";

export function cloudPrice(period: BillingPeriod) {
  const totalCents =
    period === "yearly"
      ? (site.cloud.monthlyCents *
          12 *
          (100 - site.cloud.yearlyDiscountPercent)) /
        100
      : site.cloud.monthlyCents;
  return {
    totalCents,
    monthlyCents: period === "yearly" ? totalCents / 12 : totalCents,
  };
}

export function euro(cents: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function emailLink(address: string, subject: string, body = "") {
  const params = new URLSearchParams({ subject, ...(body ? { body } : {}) });
  return `mailto:${address}?${params.toString().replaceAll("+", "%20")}`;
}
