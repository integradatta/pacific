export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export interface TenantPublic { id: string; name: string; orgCode: string; status: TenantStatus; }
