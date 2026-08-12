export type EventType =
  | "training"
  | "dual"
  | "tournament"
  | "rest"
  | "offseason"
  | "major";

export type SeasonEvent = {
  id: string;
  week: number;
  title: string;
  type: EventType;
  location: string;
  detail: string;
  major?: boolean;
};

export const YEAR_WEEKS = 52;

/** Event types that open the Match simulation. */
export const WRESTLE_EVENT_TYPES: EventType[] = ["dual", "tournament", "major"];

export const EVENT_STYLES: Record<EventType, { label: string; className: string }> = {
  training: {
    label: "Training",
    className: "border-mat/60 bg-mat/30 text-mat-bright",
  },
  dual: {
    label: "Dual Meet",
    className: "border-accent/50 bg-accent/15 text-accent",
  },
  tournament: {
    label: "Tournament",
    className: "border-danger/50 bg-danger/15 text-danger-soft",
  },
  rest: {
    label: "Recovery",
    className: "border-panel-border bg-panel text-muted",
  },
  offseason: {
    label: "Off-Season",
    className: "border-accent/30 bg-accent/10 text-accent",
  },
  major: {
    label: "Major",
    className: "border-accent bg-accent/20 text-accent",
  },
};

/** Approximate calendar-year wrestling schedule (Week 1 ≈ early January). */
export const YEAR_SCHEDULE: SeasonEvent[] = [
  { id: "w1", week: 1, title: "New Year Room Reset", type: "training", location: "Home Room", detail: "Technique goals and winter plan" },
  { id: "w2", week: 2, title: "vs Northridge", type: "dual", location: "Home", detail: "Mid-season conference dual" },
  { id: "w3", week: 3, title: "Open Mat Session", type: "training", location: "Home Room", detail: "Partner live goes" },
  { id: "w4", week: 4, title: "Valley Invite", type: "tournament", location: "Valley HS", detail: "16-man midwinter bracket with wrestle-backs" },
  { id: "w5", week: 5, title: "Active Recovery", type: "rest", location: "Training Center", detail: "Light drill and mobility" },
  { id: "w6", week: 6, title: "vs Eastside", type: "dual", location: "Away", detail: "Road dual — tough lineup" },
  { id: "w7", week: 7, title: "Conditioning Camp", type: "training", location: "Home Room", detail: "Match-pace circuits" },
  { id: "w8", week: 8, title: "Conference Duals", type: "tournament", location: "Central Arena", detail: "Round-robin conference weekend" },
  { id: "w9", week: 9, title: "vs Central", type: "dual", location: "Home", detail: "Rivalry dual night" },
  { id: "w10", week: 10, title: "Regional Preview", type: "tournament", location: "Regional Center", detail: "Tune-up before sectionals" },
  { id: "w11", week: 11, title: "Film & Recovery", type: "rest", location: "Film Room", detail: "Scout bracket opponents" },
  { id: "w12", week: 12, title: "vs Westbrook", type: "dual", location: "Home", detail: "Senior night dual" },
  { id: "w13", week: 13, title: "Sectionals", type: "tournament", location: "Section Site", detail: "Qualify for the state meet", major: true },
  { id: "w14", week: 14, title: "State Championships", type: "major", location: "State Arena", detail: "Season-defining weekend", major: true },
  { id: "w15", week: 15, title: "Post-State Unload", type: "rest", location: "Home", detail: "Recover after the run" },
  { id: "w16", week: 16, title: "Freestyle Transition", type: "offseason", location: "Regional OTC", detail: "Convert folkstyle to freestyle" },
  { id: "w18", week: 18, title: "Beat the Streets Dual", type: "offseason", location: "City Center", detail: "Exhibition dual series" },
  { id: "w20", week: 20, title: "Spring Folkstyle Camp", type: "training", location: "Home Room", detail: "Keep chains sharp" },
  { id: "w22", week: 22, title: "NHSCA Nationals", type: "major", location: "Virginia Beach, VA", detail: "High school national tournament", major: true },
  { id: "w24", week: 24, title: "Summer Strength Block", type: "training", location: "Weight Room", detail: "Power and durability focus" },
  { id: "w26", week: 26, title: "College Exposure Camp", type: "offseason", location: "Campus Circuit", detail: "Recruiting and live sparring" },
  { id: "w28", week: 28, title: "Pre-Fargo Tune-Up", type: "training", location: "Home Room", detail: "Freestyle scoring chains" },
  { id: "w29", week: 29, title: "Fargo Nationals", type: "major", location: "Fargo, ND", detail: "Junior & 16U national championships", major: true },
  { id: "w30", week: 30, title: "Post-Fargo Recovery", type: "rest", location: "Home", detail: "Unload after nationals" },
  { id: "w32", week: 32, title: "Late Summer Open Mat", type: "training", location: "Home Room", detail: "Rebuild base before fall" },
  { id: "w35", week: 35, title: "Preseason Kickoff", type: "training", location: "Home Room", detail: "New season standards" },
  { id: "w36", week: 36, title: "Ironman", type: "major", location: "Walsh Jesuit, OH", detail: "Premier early-season invitational", major: true },
  { id: "w38", week: 38, title: "Beast of the East", type: "major", location: "University of Delaware", detail: "Elite early-season tournament", major: true },
  { id: "w40", week: 40, title: "Conference Opener", type: "dual", location: "Away", detail: "First league dual of the fall" },
  { id: "w42", week: 42, title: "Super 32", type: "major", location: "Greensboro, NC", detail: "National early-season showcase", major: true },
  { id: "w43", week: 43, title: "Post-Super 32 Recovery", type: "rest", location: "Home", detail: "Reset after the grind" },
  { id: "w45", week: 45, title: "Thanksgiving Duals", type: "tournament", location: "Regional Arena", detail: "Holiday dual tournament" },
  { id: "w47", week: 47, title: "vs Lakewood", type: "dual", location: "Home", detail: "Midwinter dual meet" },
  { id: "w49", week: 49, title: "Holiday Training Block", type: "training", location: "Home Room", detail: "Volume before winter break ends" },
  { id: "w51", week: 51, title: "New Year Dual Preview", type: "dual", location: "Away", detail: "Tune-up into January" },
  { id: "w52", week: 52, title: "Year-End Review", type: "rest", location: "Film Room", detail: "Goals for the next cycle" },
];

export function eventsForWeek(weekNum: number): SeasonEvent[] {
  return YEAR_SCHEDULE.filter((event) => event.week === weekNum);
}

export function isWrestleEvent(event: SeasonEvent): boolean {
  return WRESTLE_EVENT_TYPES.includes(event.type);
}

/** First wrestleable event scheduled for this career week, if any. */
export function getCurrentWrestleEvent(week: number): SeasonEvent | null {
  const weekNum = Math.min(Math.max(week, 1), YEAR_WEEKS);
  return eventsForWeek(weekNum).find(isWrestleEvent) ?? null;
}

export function wrestleEventsForWeek(week: number): SeasonEvent[] {
  return eventsForWeek(week).filter(isWrestleEvent);
}
