"use client";

import { useState } from "react";
import type { Match } from "@/types/domain";
import { SearchBox } from "./SearchBox";
import { UpcomingSection } from "./UpcomingSection";
import { ResultsSection } from "./ResultsSection";

interface Props {
  upcoming: Match[];
  recent: Match[];
  upcomingError: string | null;
  recentError: string | null;
}

export function HomeDashboard({ upcoming, recent, upcomingError, recentError }: Props) {
  const [query, setQuery] = useState("");
  return (
    <div className="space-y-10">
      <SearchBox onSearch={setQuery} />
      <UpcomingSection matches={upcoming} error={upcomingError} query={query} />
      <ResultsSection matches={recent} error={recentError} query={query} />
    </div>
  );
}
