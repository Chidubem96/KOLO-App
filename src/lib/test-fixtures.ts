/* Shared builders for unit tests. Not imported by the app. */
import type { KoloData, Profile, Txn, CircleFull } from "./types";
import { iso, addDays, todayStr } from "./format";

export const recentDate = (daysBack: number) => iso(addDays(todayStr(), -daysBack));

export const profile = (over: Partial<Profile> = {}): Profile => ({
  id: "u1",
  name: "Test",
  incomeType: "salaried",
  incomeAmount: 500_000,
  incomeDay: 25,
  bufferK: 0.5,
  rent: null,
  salaryDay: 25,
  lang: "en",
  dismissedSigs: [],
  onboarded: true,
  reliabilityScore: 100,
  bvnVerified: false,
  ninVerified: false,
  phoneVerified: false,
  payoutAccount: null,
  ...over,
});

export const txn = (over: Partial<Txn> = {}): Txn => ({
  id: Math.random().toString(36).slice(2),
  date: todayStr(),
  amount: 5000,
  category: "food",
  note: "",
  person: false,
  source: "manual",
  auto: false,
  period: null,
  ...over,
});

export const circle = (over: Partial<CircleFull> = {}): CircleFull =>
  ({
    id: "c1",
    code: "ABC123",
    name: "Test Circle",
    type: "rotating",
    cadence: "monthly",
    amount: 10_000,
    startDate: recentDate(60),
    anchorDay: 1,
    graceDays: 3,
    lateFee: 0,
    createdBy: "u1",
    discoverable: false,
    category: "General",
    reliabilityFloor: 0,
    payoutOrder: "join",
    floatEnabled: false,
    guaranteeFund: 0,
    organiserStake: 0,
    maxSize: 12,
    blurb: "",
    orgLabel: "",
    members: [
      { id: "m1", circleId: "c1", userId: "u1", name: "Test", slot: 1, autoDebit: true, joinedAt: recentDate(60) },
    ],
    contributions: [],
    disputes: [],
    joinRequests: [],
    floatVotes: [],
    ...over,
  }) as CircleFull;

export const kolo = (over: Partial<KoloData> = {}): KoloData => ({
  profile: profile(),
  accounts: [{ id: "a1", name: "GTB", balance: 300_000, liquid: true, locked: false }],
  transactions: [],
  obligations: [],
  goals: [],
  circles: [],
  investments: [],
  directory: {},
  myRequests: [],
  userId: "u1",
  ...over,
});
