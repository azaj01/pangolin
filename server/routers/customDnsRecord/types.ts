export const CUSTOM_DNS_RECORD_TYPES = [
    "A",
    "AAAA",
    "CNAME",
    "MX",
    "NS",
    "SRV",
    "TXT"
] as const;

export type CustomDnsRecordType = (typeof CUSTOM_DNS_RECORD_TYPES)[number];

export type CustomDnsRecordRow = {
    customDnsRecordId: number;
    domainId: string;
    name: string;
    fullDomain: string;
    type: CustomDnsRecordType;
    value: string;
    ttl: number;
    priority: number | null;
    weight: number | null;
    port: number | null;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
};

export type ListCustomDnsRecordsResponse = {
    records: CustomDnsRecordRow[];
};

export type CreateCustomDnsRecordsResponse = {
    records: CustomDnsRecordRow[];
};

export type UpdateCustomDnsRecordResponse = CustomDnsRecordRow;
