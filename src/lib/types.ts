export type IncomeType = "salaried" | "irregular" | "mixed";
export type Cadence = "monthly" | "weekly";

export interface Profile {
  id: string;
  name: string;
  incomeType: IncomeType;
  incomeAmount: number;
  incomeDay: number;
  bufferK: number;
  rent: number | null;
  salaryDay: number | null;
  lang: string;
  dismissedSigs: string[];
  onboarded: boolean;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  liquid: boolean;
  locked: boolean;
}

export interface Txn {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string | null;
  note: string;
  person: boolean;
  source: string;
  auto: boolean;
  period: string | null;
}

export interface Obligation {
  id: string;
  label: string;
  kind: string;
  amount: number;
  cadence: Cadence;
  anchorDay: number;
  active: boolean;
  source: string;
  category: string;
  autoPost: boolean;
  since: string;
  sig: string | null;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string;
  priority: number;
  paused: boolean;
  contribLog: { date: string; amount: number }[];
}

export interface Circle {
  id: string;
  code: string;
  name: string;
  type: string;
  cadence: Cadence;
  amount: number;
  startDate: string;
  anchorDay: number;
  graceDays: number;
  lateFee: number;
  createdBy: string | null;
}

export interface CircleMember {
  id: string;
  circleId: string;
  userId: string;
  name: string;
  slot: number;
  autoDebit: boolean;
  joinedAt: string;
}

export interface CircleContribution {
  id: string;
  circleId: string;
  userId: string;
  cycle: number;
  paidOn: string;
  amount: number;
  auto: boolean;
}

export interface CircleFull extends Circle {
  members: CircleMember[];
  contributions: CircleContribution[];
}

export interface KoloData {
  profile: Profile;
  accounts: Account[];
  transactions: Txn[];
  obligations: Obligation[];
  goals: Goal[];
  circles: CircleFull[];
  userId: string;
}

export interface DraftTxn {
  amount: number;
  date: string;
  direction: "debit" | "credit";
  category: string | null;
  note: string;
  person: boolean;
  include: boolean;
}
