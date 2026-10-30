/** Official API DTOs. No UI/runtime imports; also structurally compatible with MapCity. */
export interface AllianceMapAlliance {
  aid: string;
  abbr: string;
  name: string;
  member_count: number | null;
}

export interface AllianceMapCity {
  uid: string;
  nick_name: string | null;
  kid: number;
  x: number;
  y: number;
  power: number | null;
  /** Unmodified provider town_center_level. */
  tc: number | null;
  aid: string | null;
  alliance_abbr: string | null;
  shield_active: null;
  burn_active: null;
  /** Provider profile cache timestamp in Unix seconds, NOT position observation time. */
  profile_cached_at: number | null;
}

export interface AllianceMapListResponse {
  ok: true;
  kind: 'alliances';
  kid: number;
  alliances: AllianceMapAlliance[];
}

export interface AllianceMapPositionsResponse {
  ok: true;
  kind: 'positions';
  kid: number;
  tag: string;
  coverage: 'alliance_profiles';
  bounds: { min: 0; max: 1200 };
  cities: AllianceMapCity[];
  alliance: Pick<AllianceMapAlliance, 'aid' | 'abbr' | 'name'>;
  roster_count: number;
  /** Number checked in this batch, including failed/missing/outside-kingdom entries. */
  processed: number;
  next_offset: number | null;
  failed: number;
  unlocated: number;
  outside_kingdom: number;
  /** Interactive results also contribute to the stored kingdom map when available. */
  stored?: boolean;
}

export type AllianceMapResponse = AllianceMapListResponse | AllianceMapPositionsResponse;

export interface AllianceMapErrorResponse {
  ok: false;
  error: string;
  message: string;
  retryAfter?: number;
}
