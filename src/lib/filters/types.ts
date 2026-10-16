export type DatePreset = "all" | "today" | "next7" | "date";
export interface DateFilterValue {
  preset: DatePreset;
  /** YYYY-MM-DD (día local), solo si preset === "date" */
  date: string | null;
}
export type Period = "all" | "7d" | "30d" | "90d";

export interface MatchCriteria {
  leagueIds: string[];
  regions: string[];
  teamIds: string[];
  tournaments: string[];
  date: DateFilterValue;
  period: Period;
  query: string;
}

export const EMPTY_DATE: DateFilterValue = { preset: "all", date: null };
export const EMPTY_CRITERIA: MatchCriteria = {
  leagueIds: [], regions: [], teamIds: [], tournaments: [], date: EMPTY_DATE, period: "all", query: "",
};
