
import { BossType } from "./types";

export const CONSTANTS = {
  // World
  LANE_WIDTH: 600,
  SCROLL_SPEED_BASE: 8, // Faster start
  SCROLL_SPEED_MAX: 35, 
  
  // Soldier (Blue Team)
  SOLDIER_RADIUS: 5,
  SOLDIER_SPEED: 0.25, // Slightly snappier to compensate for speed
  SOLDIER_COLOR: '#3b82f6', // blue-500
  SOLDIER_START_COUNT: 10,
  
  // Enemy (Red Team)
  ENEMY_RADIUS: 6,
  ENEMY_COLOR: '#ef4444', // red-500
  ENEMY_SPEED_ADD: 4, 
  
  // Boss
  BOSS_SPAWN_DISTANCE: 3000, 
  BOSS_HP_BASE: 2500, // Tankier
  BOSS_WIDTH: 120,
  BOSS_HEIGHT: 120,
  
  BOSS_CONFIGS: {
      [BossType.SIEGE_BREAKER]: {
          name: "SIEGE BREAKER",
          color: '#7f1d1d',
          hpMultiplier: 1.0,
          bulletColor: '#ef4444'
      },
      [BossType.THE_ALGORITHM]: {
          name: "THE ALGORITHM",
          color: '#10b981', // Green
          hpMultiplier: 0.8, // Less HP, moves more
          bulletColor: '#00ff00'
      },
      [BossType.THE_MONETIZER]: {
          name: "THE MONETIZER",
          color: '#fbbf24', // Gold
          hpMultiplier: 1.2, // Tanky
          bulletColor: '#f59e0b'
      }
  },
  
  // Shooting
  FIRE_RATE: 15, 
  BULLET_SPEED: 22,
  BULLET_RADIUS: 4,
  BULLET_DAMAGE: 15,
  RANGE: 650,
  
  // Weapons
  WEAPON_DURATION: 500, 
  POWERUP_RADIUS: 12,
  POWERUP_DROP_CHANCE: 0.08, // Rarer
  
  // Ultimate (Ion Cannon)
  ULTIMATE_MAX_CHARGE: 150, // Harder to get
  ULTIMATE_DURATION: 120, 
  ULTIMATE_WIDTH: 120,
  
  // Enemies Objects
  BARREL_RADIUS: 22,
  BARREL_HP_BASE: 50,
  BARREL_COLOR: '#92400e',
  
  // Gates
  GATE_HEIGHT: 10,
  
  // UI
  FONT_FAMILY: 'Impact, "Segoe UI", sans-serif',

  // --- NEW MECHANICS ---
  PUNISHMENT_DURATION: 180, // 3 seconds of inverted controls
  OVERDRIVE_THRESHOLD: 30, // Combo needed for boost
  
  TAUNTS: [
      "SKILL ISSUE",
      "PATHETIC",
      "DELETE SYSTEM32?",
      "LAG?",
      "HUMAN ERROR",
      "PREDICTABLE",
      "DISAPPOINTING",
      "TRY HARDER",
      "GEN Z ATTENTION SPAN?",
      "FATAL EXCEPTION"
  ],
  
  PRAISES: [
      "OPTIMAL",
      "ASCENDING",
      "DOPAMINE HIT",
      "UNSTOPPABLE",
      "GODLIKE",
      "SYSTEM OVERLOAD",
      "ABSOLUTE CINEMA"
  ],

  KONAMI_CODE: [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", 
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", 
      "b", "a"
  ]
};
