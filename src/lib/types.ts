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
  reliabilityScore: number;
  bvnVerified: boolean;
  ninVerified: boolean;
  phoneVerified: boolean;
  payoutAccount: string | null;
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
  discoverable: boolean;
  category: string;
  reliabilityFloor: number;
  payoutOrder: string;
  floatEnabled: boolean;
  guaranteeFund: number;
  organiserStake: number;
  maxSize: number;
  blurb: string;
  orgLabel: string;
}

export interface JoinRequest {
  id: string;
  circleId: string;
  userId: string;
  name: string;
  score: number;
  message: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
}

export interface Dispute {
  id: string;
  circleId: string;
  raisedBy: string;
  raisedByName: string;
  subject: string;
  reason: string;
  note: string;
  status: "open" | "resolved";
  createdAt: string;
}

export interface FloatVote {
  id: string;
  circleId: string;
  userId: string;
  cycle: number;
  vote: "in" | "out";
}

export interface Investment {
  id: string;
  product: string;
  kind: "naira" | "dollar";
  amount: number;
  createdAt: string;
}

export interface DirectoryEntry {
  userId: string;
  name: string;
  reliabilityScore: number;
  cyclesCompleted: number;
  bvnVerified: boolean;
  ninVerified: boolean;
  phoneVerified: boolean;
}

export interface DiscoverCircle {
  id: string;
  code: string;
  name: string;
  orgLabel: string;
  category: string;
  blurb: string;
  amount: number;
  cadence: string;
  type: string;
  maxSize: number;
  memberCount: number;
  reliabilityFloor: number;
  guaranteeFund: number;
  organiserStake: number;
  completion: number;
  cyclesDone: number;
  myScore: number;
  pending: boolean;
  seed?: boolean;
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
  disputes: Dispute[];
  joinRequests: JoinRequest[];
  floatVotes: FloatVote[];
}

export interface KoloData {
  profile: Profile;
  accounts: Account[];
  transactions: Txn[];
  obligations: Obligation[];
  goals: Goal[];
  circles: CircleFull[];
  investments: Investment[];
  directory: Record<string, DirectoryEntry>;
  myRequests: JoinRequest[];
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
  dupe?: boolean; // matches a row already in this batch or a recent transaction
  recurring?: boolean; // user said this repeats monthly -> also create an obligation
}
