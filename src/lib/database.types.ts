/**
 * Savborne — Supabase database types (hand-written)
 *
 * Mirrors `supabase/migrations/0001_init.sql`. Regenerate with
 * `npx supabase gen types typescript --project-id <id>` once the project
 * is live and replace this file.
 */

import type { Bracket, MoveType } from './constants'

export type Database = {
  public: {
    Tables: {
      players: {
        Row: {
          address: string
          savings_account_address: string
          display_name: string
          created_at: string
          last_check_in_at: string | null
          level: number
          xp: number
          rating: number
          bracket: Bracket | null
          current_balance_luna: number
          streak_current: number
          streak_best: number
          grace_used_this_week: boolean
          shields: number
          shields_earned: number
          week_started_at: string | null
          check_in_count: number
          wins: number
          losses: number
          ties: number
          withdrawal_in_progress: boolean
          last_withdrawal_at: string | null
          steady_hand_started_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['players']['Row']> & {
          address: string
          savings_account_address: string
          display_name: string
        }
        Update: Partial<Database['public']['Tables']['players']['Row']>
      }
      check_ins: {
        Row: {
          id: number
          player_address: string
          balance_luna: number
          recorded_at: string
        }
        Insert: Omit<Database['public']['Tables']['check_ins']['Row'], 'id' | 'recorded_at'>
        Update: never
      }
      missions: {
        Row: {
          id: number
          key: string
          name: string
          description: string
          type: 'daily' | 'weekly' | 'onetime'
          xp_reward: number
          bracket_required: Bracket | null
        }
        Insert: Omit<Database['public']['Tables']['missions']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['missions']['Row']>
      }
      player_missions: {
        Row: {
          id: number
          player_address: string
          mission_key: string
          completed_at: string
          reset_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['player_missions']['Row'], 'id'> & {
          reset_at?: string | null
        }
        Update: never
      }
      items: {
        Row: {
          id: number
          key: string
          name: string
          description: string
          bracket: Bracket
          effect_type: string
          effect_value: number
          is_badge: boolean
        }
        Insert: Omit<Database['public']['Tables']['items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['items']['Row']>
      }
      player_items: {
        Row: {
          id: number
          player_address: string
          item_key: string
          unlocked_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_items']['Row'], 'id' | 'unlocked_at'>
        Update: never
      }
      badges: {
        Row: {
          id: number
          key: string
          name: string
          description: string
          revoked_on_withdrawal: boolean
        }
        Insert: Omit<Database['public']['Tables']['badges']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['badges']['Row']>
      }
      player_badges: {
        Row: {
          id: number
          player_address: string
          badge_key: string
          awarded_at: string
          revoked_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['player_badges']['Row'], 'id' | 'awarded_at'> & {
          revoked_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['player_badges']['Row']>
      }
      battles: {
        Row: {
          id: string
          mode: 'ranked' | 'unranked' | 'ai'
          status: 'pending' | 'active' | 'completed' | 'abandoned'
          player_a: string
          player_b: string
          current_turn: number
          turn_deadline: string | null
          player_a_hp: number
          player_b_hp: number
          winner: string | null
          created_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: Omit<
          Database['public']['Tables']['battles']['Row'],
          'created_at' | 'started_at' | 'completed_at'
        > & {
          id?: string
        }
        Update: Partial<Database['public']['Tables']['battles']['Row']>
      }
      battle_moves: {
        Row: {
          id: number
          battle_id: string
          player_address: string
          turn_number: number
          move_type: MoveType
          item_key: string | null
          resolved_damage: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['battle_moves']['Row'], 'id' | 'created_at'> & {
          item_key?: string | null
        }
        Update: never
      }
      queue: {
        Row: {
          player_address: string
          bracket: Bracket
          rating: number
          entered_at: string
          last_poll_at: string
          status: 'waiting' | 'matched' | 'cancelled'
          battle_id: string | null
        }
        Insert: Omit<Database['public']['Tables']['queue']['Row'], 'entered_at' | 'last_poll_at' | 'battle_id'> & {
          battle_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['queue']['Row']>
      }
      daily_battles: {
        Row: {
          player_address: string
          utc_date: string
          count: number
        }
        Insert: Database['public']['Tables']['daily_battles']['Row']
        Update: Partial<Database['public']['Tables']['daily_battles']['Row']>
      }
      daily_xp: {
        Row: {
          player_address: string
          utc_date: string
          xp_earned: number
        }
        Insert: Database['public']['Tables']['daily_xp']['Row']
        Update: Partial<Database['public']['Tables']['daily_xp']['Row']>
      }
      vaults: {
        Row: {
          address: string
          player_address: string
          network: 'mainnet' | 'testnet'
          card_token: string
          backup_verified_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['vaults']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['vaults']['Row']>
      }
      transfers: {
        Row: {
          id: number
          player_address: string
          vault_address: string
          direction: 'in' | 'out'
          amount_luna: number
          fee_luna: number
          tx_hash: string
          status: 'pending' | 'included' | 'expired'
          block_height: number | null
          failure_reason: string | null
          created_at: string
          confirmed_at: string | null
        }
        Insert: Omit<
          Database['public']['Tables']['transfers']['Row'],
          'id' | 'fee_luna' | 'status' | 'block_height' | 'failure_reason' | 'created_at' | 'confirmed_at'
        > & {
          fee_luna?: number
          status?: 'pending' | 'included' | 'expired'
          block_height?: number | null
          failure_reason?: string | null
          confirmed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['transfers']['Row']>
      }
    }
  }
}

export type PlayerRow = Database['public']['Tables']['players']['Row']
export type CheckInRow = Database['public']['Tables']['check_ins']['Row']
export type VaultRow = Database['public']['Tables']['vaults']['Row']
export type TransferRow = Database['public']['Tables']['transfers']['Row']
