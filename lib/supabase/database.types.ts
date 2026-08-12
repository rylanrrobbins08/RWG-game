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
  created_at?: string;
  updated_at?: string;
};

export type WrestlerUpdate = Partial<WrestlerInsert>;

export type Database = {
  public: {
    Tables: {
      wrestlers: {
        Row: WrestlerRow;
        Insert: WrestlerInsert;
        Update: WrestlerUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
