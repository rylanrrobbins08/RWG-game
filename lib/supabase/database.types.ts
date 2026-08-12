import type { AttributeScores, Wrestler } from "@/lib/game-store";
import type { Injury } from "@/lib/injury";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WrestlerRow = {
  id: string;
  user_id: string;
  name: string;
  weight_class: number;
  natural_weight?: number | null;
  weight_cut?: string | null;
  grade?: string | null;
  study_progress?: number | null;
  hometown?: string | null;
  state?: string | null;
  national_rank?: number | null;
  state_rank?: number | null;
  attributes: AttributeScores;
  record: Wrestler["record"];
  energy: number;
  fatigue: number;
  budget: number;
  week: number;
  season: number;
  injury?: Injury | null;
  save?: Json | null;
  created_at: string;
  updated_at: string;
};

export type WrestlerInsert = {
  id?: string;
  user_id: string;
  name: string;
  weight_class: number;
  natural_weight?: number;
  weight_cut?: string;
  grade?: string;
  study_progress?: number;
  hometown?: string;
  state?: string;
  national_rank?: number;
  state_rank?: number;
  attributes: AttributeScores;
  record?: Wrestler["record"];
  energy?: number;
  fatigue?: number;
  budget?: number;
  week?: number;
  season?: number;
  injury?: Injury | null;
  save?: Json;
  created_at?: string;
  updated_at?: string;
};

export type WrestlerUpdate = Partial<WrestlerInsert>;

export type LeagueRow = {
  id: string;
  name: string;
  code: string;
  created_by: string | null;
  is_open: boolean;
  created_at: string;
};

export type LeagueMemberRow = {
  id: string;
  league_id: string;
  member_key: string;
  user_id: string | null;
  wrestler_name: string;
  school: string;
  weight_class: number;
  wins: number;
  losses: number;
  attributes: Json;
  is_bot: boolean;
  tier: string | null;
  updated_at: string;
};

export type LeagueMatchRow = {
  id: string;
  league_id: string;
  event_id: string;
  week: number;
  member_a: string;
  member_b: string;
  winner_key: string | null;
  score_a: number | null;
  score_b: number | null;
  completed_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      wrestlers: {
        Row: WrestlerRow;
        Insert: WrestlerInsert;
        Update: WrestlerUpdate;
        Relationships: [];
      };
      leagues: {
        Row: LeagueRow;
        Insert: {
          id: string;
          name: string;
          code: string;
          created_by?: string | null;
          is_open?: boolean;
          created_at?: string;
        };
        Update: Partial<LeagueRow>;
        Relationships: [];
      };
      league_members: {
        Row: LeagueMemberRow;
        Insert: {
          id?: string;
          league_id: string;
          member_key: string;
          user_id?: string | null;
          wrestler_name: string;
          school?: string;
          weight_class: number;
          wins?: number;
          losses?: number;
          attributes?: Json;
          is_bot?: boolean;
          tier?: string | null;
          updated_at?: string;
        };
        Update: Partial<LeagueMemberRow>;
        Relationships: [];
      };
      league_matches: {
        Row: LeagueMatchRow;
        Insert: {
          id?: string;
          league_id: string;
          event_id: string;
          week?: number;
          member_a: string;
          member_b: string;
          winner_key?: string | null;
          score_a?: number | null;
          score_b?: number | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<LeagueMatchRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
