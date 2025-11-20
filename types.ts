
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity extends Point {
  id: string;
  radius: number;
  markedForDeletion: boolean;
}

export interface Soldier extends Entity {
  targetX: number; // The flocked x position
  targetY: number;
  shootCooldown: number;
}

export interface EnemySoldier extends Entity {
  hp: number;
  speed: number;
}

export enum BossType {
  SIEGE_BREAKER = 'SIEGE_BREAKER',
  THE_ALGORITHM = 'THE_ALGORITHM',
  THE_MONETIZER = 'THE_MONETIZER',
}

export interface Boss extends Entity {
  hp: number;
  maxHp: number;
  state: 'ENTERING' | 'FIGHTING' | 'DYING';
  attackCooldown: number;
  width: number;
  height: number;
  type: BossType;
  // Specific visuals
  rotation?: number;
  teleportTimer?: number;
}

export interface Bullet extends Entity {
  vx: number;
  vy: number;
  damage: number;
  isEnemy: boolean; // True if fired by boss/enemy
  color: string;
}

export interface Barrel extends Entity {
  hp: number;
  maxHp: number;
  value: number; // Score value
}

export interface Obstacle extends Entity {
  width: number;
  height: number;
  type: 'SPIKE' | 'WALL' | 'PAYWALL';
}

export enum GateType {
  ADD = 'ADD',
  MULTIPLY = 'MULTIPLY',
  SUBTRACT = 'SUBTRACT',
  DIVIDE = 'DIVIDE',
}

export interface Gate extends Entity {
  width: number;
  height: number;
  type: GateType;
  value: number;
  color: string;
}

export interface Particle extends Entity {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText extends Point {
  id: string;
  text: string;
  life: number;
  color: string;
  vy: number;
  scale: number;
}

export enum WeaponType {
  DEFAULT = 'DEFAULT',
  SPREAD = 'SPREAD',
  RAPID = 'RAPID',
}

export interface PowerUp extends Entity {
  type: WeaponType;
  color: string;
  life: number;
}
