
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CONSTANTS } from '../constants';
import { 
  GameState, Soldier, Bullet, Barrel, Gate, GateType, Particle, FloatingText, Entity, EnemySoldier, Boss, BossType, Obstacle, PowerUp, WeaponType 
} from '../types';
import { initAudio, playSound, startBossMusic, stopMusic } from '../audio';

interface GameEngineProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  setSoldierCount: (count: number) => void;
  setUltimateCharge: (charge: number) => void;
  setCombo: (combo: number) => void;
  triggerUltimate: boolean; // Prop signal to fire
  setTriggerUltimate: (v: boolean) => void;
  setSystemStatus: (status: 'STABLE' | 'OVERDRIVE' | 'CORRUPTED') => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ 
  gameState, 
  setGameState, 
  setScore,
  setSoldierCount,
  setUltimateCharge,
  setCombo,
  triggerUltimate,
  setTriggerUltimate,
  setSystemStatus
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const scoreRef = useRef<number>(0);
  
  // --- Game State Refs ---
  const soldiers = useRef<Soldier[]>([]);
  const enemies = useRef<EnemySoldier[]>([]);
  const bullets = useRef<Bullet[]>([]);
  const barrels = useRef<Barrel[]>([]);
  const gates = useRef<Gate[]>([]);
  const obstacles = useRef<Obstacle[]>([]);
  const particles = useRef<Particle[]>([]);
  const floatingTexts = useRef<FloatingText[]>([]);
  const powerUps = useRef<PowerUp[]>([]);
  const boss = useRef<Boss | null>(null);
  
  const mouseX = useRef<number>(0);
  const worldSpeed = useRef<number>(CONSTANTS.SCROLL_SPEED_BASE);
  const distanceTraveled = useRef<number>(0);
  const difficultyMultiplier = useRef<number>(1);
  const frames = useRef<number>(0);
  const shakeIntensity = useRef<number>(0);
  const flashIntensity = useRef<number>(0); 
  const nextBossDistance = useRef<number>(CONSTANTS.BOSS_SPAWN_DISTANCE);
  
  // --- New Sandbox Features ---
  const currentWeapon = useRef<WeaponType>(WeaponType.DEFAULT);
  const weaponTimer = useRef<number>(0);
  const ultimateCharge = useRef<number>(0);
  const ultimateActiveTimer = useRef<number>(0);
  const comboCounter = useRef<number>(0);
  const comboTimer = useRef<number>(0);
  const punishmentTimer = useRef<number>(0); // > 0 means controls are inverted
  
  // --- Easter Eggs ---
  const konamiIndex = useRef<number>(0);
  const godMode = useRef<boolean>(false);

  // --- Helpers ---

  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
  const generateId = () => Math.random().toString(36).substr(2, 9);
  
  const shakeScreen = (amount: number) => {
      shakeIntensity.current = Math.min(shakeIntensity.current + amount, 20);
  };

  const flashScreen = (amount: number) => {
      flashIntensity.current = amount;
  };

  const triggerTaunt = (x: number, y: number, isGood: boolean) => {
      const text = isGood 
        ? CONSTANTS.PRAISES[Math.floor(Math.random() * CONSTANTS.PRAISES.length)]
        : CONSTANTS.TAUNTS[Math.floor(Math.random() * CONSTANTS.TAUNTS.length)];
      const color = isGood ? '#facc15' : '#ef4444';
      createFloatingText(x, y - 50, text, color, isGood ? 2 : 2.5);
  };

  const triggerPunishment = () => {
      if (godMode.current) return;
      if (punishmentTimer.current > 0) return; // Already punished
      punishmentTimer.current = CONSTANTS.PUNISHMENT_DURATION;
      playSound('glitch');
      shakeScreen(15);
      flashScreen(0.5);
      triggerTaunt(mouseX.current, 300, false);
      
      // Reset combo
      comboCounter.current = 0;
      setCombo(0);
  };

  const addCombo = (amount: number) => {
      if (punishmentTimer.current > 0) return; // No combo while corrupted

      comboCounter.current += amount;
      comboTimer.current = 120; 
      setCombo(comboCounter.current);
      
      if (comboCounter.current % 10 === 0) {
          triggerTaunt(mouseX.current, 400, true);
      }

      // Charge ultimate slightly faster with combo
      ultimateCharge.current = Math.min(CONSTANTS.ULTIMATE_MAX_CHARGE, ultimateCharge.current + amount * 0.5);
      setUltimateCharge(ultimateCharge.current);
  };

  const createSoldier = (x: number, y: number): Soldier => ({
    id: generateId(),
    x,
    y,
    targetX: x,
    targetY: y,
    radius: CONSTANTS.SOLDIER_RADIUS,
    markedForDeletion: false,
    shootCooldown: Math.floor(Math.random() * CONSTANTS.FIRE_RATE),
  });

  const createExplosion = (x: number, y: number, color: string, count: number = 8, speed: number = 10) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        id: generateId(),
        x,
        y,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        radius: Math.random() * 4 + 2,
        life: 1.0,
        maxLife: 1.0,
        color,
        markedForDeletion: false,
        size: Math.random() * 4 + 2,
      });
    }
  };

  const createFloatingText = (x: number, y: number, text: string, color: string = '#fff', scale: number = 1) => {
    floatingTexts.current.push({
      id: generateId(),
      x,
      y,
      text,
      life: 1.0,
      vy: -3,
      color,
      scale,
    });
  };

  const spawnPowerUp = (x: number, y: number) => {
      if (Math.random() < CONSTANTS.POWERUP_DROP_CHANCE || godMode.current) {
          const isSpread = Math.random() > 0.5;
          powerUps.current.push({
              id: generateId(),
              x,
              y,
              radius: CONSTANTS.POWERUP_RADIUS,
              type: isSpread ? WeaponType.SPREAD : WeaponType.RAPID,
              color: isSpread ? '#a855f7' : '#facc15', // Purple or Yellow
              markedForDeletion: false,
              life: 600 // Despawn eventually
          });
      }
  };

  const spawnEnemyWave = (canvasWidth: number) => {
      const count = Math.floor(randomRange(3, 10) * difficultyMultiplier.current);
      const centerX = randomRange(100, canvasWidth - 100);
      for(let i=0; i<count; i++) {
          enemies.current.push({
              id: generateId(),
              x: centerX + (Math.random() - 0.5) * 200,
              y: -50 - (Math.random() * 200), // Spawn above
              radius: CONSTANTS.ENEMY_RADIUS,
              speed: CONSTANTS.SCROLL_SPEED_BASE + CONSTANTS.ENEMY_SPEED_ADD + (difficultyMultiplier.current * 2),
              hp: 2 * difficultyMultiplier.current,
              markedForDeletion: false
          });
      }
  };

  const spawnObstacle = (canvasWidth: number) => {
     const width = randomRange(50, 200);
     obstacles.current.push({
         id: generateId(),
         x: randomRange(width/2, canvasWidth - width/2),
         y: -100,
         width: width,
         height: 40,
         radius: width/2, 
         type: 'SPIKE',
         markedForDeletion: false
     });
  };

  const spawnBoss = (canvasWidth: number) => {
      // Random Boss Type
      const types = [BossType.SIEGE_BREAKER, BossType.THE_ALGORITHM, BossType.THE_MONETIZER];
      const type = types[Math.floor(Math.random() * types.length)];
      
      startBossMusic(type);
      playSound('boss_spawn');
      flashScreen(1);
      shakeScreen(20);
      createFloatingText(canvasWidth/2, 200, CONSTANTS.BOSS_CONFIGS[type].name + " DETECTED", CONSTANTS.BOSS_CONFIGS[type].color, 2);
      
      boss.current = {
          id: generateId(),
          x: canvasWidth / 2,
          y: -200,
          width: CONSTANTS.BOSS_WIDTH,
          height: CONSTANTS.BOSS_HEIGHT,
          radius: CONSTANTS.BOSS_WIDTH / 2,
          hp: CONSTANTS.BOSS_HP_BASE * difficultyMultiplier.current * CONSTANTS.BOSS_CONFIGS[type].hpMultiplier,
          maxHp: CONSTANTS.BOSS_HP_BASE * difficultyMultiplier.current * CONSTANTS.BOSS_CONFIGS[type].hpMultiplier,
          state: 'ENTERING',
          attackCooldown: 100,
          markedForDeletion: false,
          type: type,
          rotation: 0,
          teleportTimer: 0
      };
  };

  const spawnBarrel = (canvasWidth: number) => {
    if (boss.current) return;

    const laneWidth = canvasWidth / 5;
    const lane = Math.floor(Math.random() * 5);
    const x = (lane * laneWidth) + (laneWidth / 2);
    const hp = Math.floor(CONSTANTS.BARREL_HP_BASE * difficultyMultiplier.current);
    
    barrels.current.push({
      id: generateId(),
      x: x + (Math.random() * 40 - 20),
      y: -100,
      radius: CONSTANTS.BARREL_RADIUS,
      hp: hp,
      maxHp: hp,
      value: 10,
      markedForDeletion: false,
    });
  };

  const spawnGate = (canvasWidth: number) => {
    if (boss.current) return; 

    const isDouble = Math.random() > 0.7;
    const yPos = -200;
    
    const createOneGate = (x: number, w: number) => {
      const r = Math.random();
      let type = GateType.MULTIPLY;
      let val = 2;
      let color = '#3b82f6'; 

      if (r < 0.4) {
        type = GateType.MULTIPLY;
        val = Math.floor(randomRange(2, 5));
        color = '#3b82f6';
      } else if (r < 0.65) {
        type = GateType.ADD;
        val = Math.floor(randomRange(15, 60));
        color = '#3b82f6';
      } else if (r < 0.85) {
        type = GateType.SUBTRACT;
        val = Math.floor(randomRange(20, 50));
        color = '#ef4444';
      } else {
        type = GateType.DIVIDE;
        val = 2;
        color = '#ef4444'; 
      }

      gates.current.push({
        id: generateId(),
        x: x, 
        y: yPos,
        width: w,
        height: CONSTANTS.GATE_HEIGHT,
        radius: 0,
        type,
        value: val,
        color,
        markedForDeletion: false,
      });
    };

    if (isDouble) {
      createOneGate(canvasWidth * 0.25, canvasWidth * 0.45);
      createOneGate(canvasWidth * 0.75, canvasWidth * 0.45);
    } else {
      createOneGate(canvasWidth * 0.5, canvasWidth * 0.9);
    }
  };

  const initGame = () => {
    initAudio();
    stopMusic();
    soldiers.current = [];
    enemies.current = [];
    bullets.current = [];
    barrels.current = [];
    gates.current = [];
    obstacles.current = [];
    particles.current = [];
    floatingTexts.current = [];
    powerUps.current = [];
    boss.current = null;
    scoreRef.current = 0;
    distanceTraveled.current = 0;
    worldSpeed.current = CONSTANTS.SCROLL_SPEED_BASE;
    difficultyMultiplier.current = 1;
    nextBossDistance.current = CONSTANTS.BOSS_SPAWN_DISTANCE;
    
    currentWeapon.current = WeaponType.DEFAULT;
    weaponTimer.current = 0;
    ultimateCharge.current = 0;
    ultimateActiveTimer.current = 0;
    comboCounter.current = 0;
    punishmentTimer.current = 0;
    
    if (canvasRef.current) {
      const cw = canvasRef.current.width;
      const ch = canvasRef.current.height;
      const startX = cw / 2;
      const startY = ch * 0.8;
      
      for (let i = 0; i < CONSTANTS.SOLDIER_START_COUNT; i++) {
        soldiers.current.push(createSoldier(startX + (Math.random() * 60 - 30), startY + (Math.random() * 60 - 30)));
      }
      mouseX.current = startX;
    }
    
    setScore(0);
    setSoldierCount(CONSTANTS.SOLDIER_START_COUNT);
    setUltimateCharge(0);
    setCombo(0);
    setSystemStatus('STABLE');
    playSound('powerup');
  };

  // --- Game Loop ---

  const update = (canvas: HTMLCanvasElement) => {
    if (gameState !== GameState.PLAYING) return;

    frames.current++;
    
    if (godMode.current) {
        ultimateCharge.current = CONSTANTS.ULTIMATE_MAX_CHARGE;
        setUltimateCharge(CONSTANTS.ULTIMATE_MAX_CHARGE);
        setSystemStatus('OVERDRIVE');
    } else {
        // Status Update
        if (punishmentTimer.current > 0) {
            setSystemStatus('CORRUPTED');
        } else if (comboCounter.current >= CONSTANTS.OVERDRIVE_THRESHOLD) {
            setSystemStatus('OVERDRIVE');
        } else {
            setSystemStatus('STABLE');
        }
    }

    // 1. Handle Ultimate Trigger
    if (triggerUltimate && ultimateCharge.current >= CONSTANTS.ULTIMATE_MAX_CHARGE) {
        ultimateActiveTimer.current = CONSTANTS.ULTIMATE_DURATION;
        ultimateCharge.current = 0;
        setUltimateCharge(0);
        playSound('beam');
        shakeScreen(20);
        flashScreen(0.8);
        setTriggerUltimate(false);
        createFloatingText(canvas.width/2, canvas.height/2, "ION CANNON DEPLOYED", '#3b82f6', 2);
    } else if (triggerUltimate) {
        setTriggerUltimate(false); // clear trigger if not ready
    }

    // Punishment Timer
    if (punishmentTimer.current > 0) {
        punishmentTimer.current--;
        if (Math.random() > 0.8) shakeScreen(5); // Glitch shakes
        if (punishmentTimer.current <= 0) {
            createFloatingText(canvas.width/2, canvas.height/2, "SYSTEM RESTORED", '#4ade80', 1.5);
        }
    }

    // Ultimate Logic (The Beam)
    if (ultimateActiveTimer.current > 0) {
        ultimateActiveTimer.current--;
        shakeScreen(2); // Continuous shake
        // Kill everything in range
        const beamX = punishmentTimer.current > 0 ? canvas.width - mouseX.current : mouseX.current;
        const beamWidth = CONSTANTS.ULTIMATE_WIDTH;
        
        const checkHit = (e: Entity) => Math.abs(e.x - beamX) < beamWidth / 2 + e.radius;
        
        enemies.current.forEach(e => {
            if (checkHit(e)) {
                e.markedForDeletion = true;
                createExplosion(e.x, e.y, '#ef4444', 5);
                addCombo(1);
            }
        });
        barrels.current.forEach(b => {
            if (checkHit(b)) {
                b.hp -= 10; // Melts barrels fast
                if(b.hp <= 0) {
                    b.markedForDeletion = true;
                    createExplosion(b.x, b.y, CONSTANTS.BARREL_COLOR, 8);
                    addCombo(1);
                }
            }
        });
        if (boss.current && checkHit(boss.current)) {
             boss.current.hp -= 10;
             createExplosion(boss.current.x, boss.current.y + 50, '#fff', 1); // Beam impact
        }
    }

    // Combo Timer
    if (comboTimer.current > 0) {
        comboTimer.current--;
        if (comboTimer.current <= 0) {
            comboCounter.current = 0;
            setCombo(0);
        }
    }

    // Weapon Timer
    if (weaponTimer.current > 0) {
        weaponTimer.current--;
        if (weaponTimer.current <= 0) {
            currentWeapon.current = WeaponType.DEFAULT;
            createFloatingText(mouseX.current, canvas.height - 100, "WEAPON DEPLETED", '#fff');
        }
    }

    // Boss Logic
    if (!boss.current) {
        distanceTraveled.current += worldSpeed.current;
        if (distanceTraveled.current >= nextBossDistance.current) {
            spawnBoss(canvas.width);
            nextBossDistance.current += CONSTANTS.BOSS_SPAWN_DISTANCE * 1.2; // Increasing gap
        }
    } else {
        // Boss Movement
        const b = boss.current;
        if (b.state === 'ENTERING') {
            b.y += 2;
            if (b.y >= 150) b.state = 'FIGHTING';
        } else if (b.state === 'FIGHTING') {
            b.attackCooldown--;
            const isRaged = b.hp < b.maxHp * 0.5;

            if (b.type === BossType.SIEGE_BREAKER) {
                // Tanky, basic movement
                b.y = 150 + Math.sin(frames.current * 0.05) * 20;
                b.x = (canvas.width / 2) + Math.sin(frames.current * 0.02) * (canvas.width * 0.35);
                
                if (b.attackCooldown <= 0) {
                     b.attackCooldown = Math.max(5, 40 - difficultyMultiplier.current * 5);
                     if (isRaged) b.attackCooldown /= 2;

                     const target = soldiers.current[Math.floor(Math.random() * soldiers.current.length)];
                     if (target) {
                        const angle = Math.atan2(target.y - b.y, target.x - b.x);
                        const shots = isRaged ? 3 : 1;
                        for(let i=0; i<shots; i++) {
                            const offset = (i - (shots-1)/2) * 0.2;
                             bullets.current.push({
                                id: generateId(),
                                x: b.x,
                                y: b.y + 60,
                                vx: Math.cos(angle + offset) * 12,
                                vy: Math.sin(angle + offset) * 12,
                                radius: 10,
                                damage: 1,
                                isEnemy: true,
                                color: isRaged ? '#ef4444' : '#f87171',
                                markedForDeletion: false
                            });
                        }
                        if (Math.random() > 0.5) playSound('shoot');
                     }
                }

            } else if (b.type === BossType.THE_ALGORITHM) {
                // Glitchy movement
                if (!b.teleportTimer) b.teleportTimer = 100;
                b.teleportTimer--;
                
                if (b.teleportTimer <= 0) {
                    playSound('glitch');
                    createExplosion(b.x, b.y, '#10b981', 20, 20); // Teleport effect
                    b.x = randomRange(100, canvas.width - 100);
                    b.y = randomRange(100, 250);
                    b.teleportTimer = isRaged ? 40 : 120;
                }

                if (b.attackCooldown <= 0) {
                     b.attackCooldown = 15; // Fast rapid fire
                     bullets.current.push({
                        id: generateId(),
                        x: b.x,
                        y: b.y,
                        vx: (Math.random() - 0.5) * 5,
                        vy: 15, // Stream down
                        radius: 5,
                        damage: 1,
                        isEnemy: true,
                        color: '#00ff00',
                        markedForDeletion: false
                    });
                }

            } else if (b.type === BossType.THE_MONETIZER) {
                // Spawns paywalls
                b.x = (canvas.width / 2) + Math.sin(frames.current * 0.01) * (canvas.width * 0.4);
                
                if (b.attackCooldown <= 0) {
                    b.attackCooldown = 60;
                    // Spawn Coin Bullet
                    bullets.current.push({
                        id: generateId(),
                        x: b.x,
                        y: b.y,
                        vx: 0,
                        vy: 10,
                        radius: 15, // Big coin
                        damage: 5,
                        isEnemy: true,
                        color: '#fbbf24',
                        markedForDeletion: false
                    });
                    playSound('coin');

                    // Spawn Paywall (Obstacle) occasionally
                    if (Math.random() > 0.7) {
                        obstacles.current.push({
                             id: generateId(),
                             x: b.x,
                             y: b.y + 100,
                             width: 100,
                             height: 20,
                             radius: 50,
                             type: 'PAYWALL',
                             markedForDeletion: false
                        });
                    }
                }
            }
        }
        
        if (b.hp <= 0) {
            createExplosion(b.x, b.y, '#fbbf24', 50, 30);
            createExplosion(b.x, b.y, '#ef4444', 50, 30);
            shakeScreen(30);
            flashScreen(1);
            playSound('explosion');
            stopMusic();
            scoreRef.current += 5000;
            b.markedForDeletion = true;
            boss.current = null;
            worldSpeed.current += 2;
            createFloatingText(canvas.width/2, canvas.height/2, "THREAT ELIMINATED", '#fbbf24', 3);
            addCombo(100);
            spawnPowerUp(b.x, b.y); 
            spawnPowerUp(b.x + 40, b.y);
            spawnPowerUp(b.x - 40, b.y);
        }
    }

    difficultyMultiplier.current = 1 + (distanceTraveled.current / 4000); // Ramps harder

    // Spawning
    if (!boss.current) {
        if (frames.current % Math.floor(30 / difficultyMultiplier.current) === 0 && Math.random() > 0.5) spawnBarrel(canvas.width);
        if (frames.current % 200 === 0) spawnGate(canvas.width);
        if (frames.current % 100 === 0 && Math.random() > 0.4) spawnEnemyWave(canvas.width); // More enemies
        if (frames.current % 250 === 0 && Math.random() > 0.6) spawnObstacle(canvas.width);
        
        if (worldSpeed.current < CONSTANTS.SCROLL_SPEED_MAX) {
            worldSpeed.current += 0.005;
        }
    }

    // 1. Move Player Squad
    // CORRUPTION LOGIC: Invert Mouse X if punished
    let targetX = mouseX.current;
    if (punishmentTimer.current > 0) {
        targetX = canvas.width - mouseX.current;
    }
    
    targetX = Math.max(50, Math.min(canvas.width - 50, targetX));
    
    // Overdrive Logic: Buffs
    const isOverdrive = comboCounter.current >= CONSTANTS.OVERDRIVE_THRESHOLD || godMode.current;

    soldiers.current.forEach((soldier, index) => {
      let pushX = 0;
      let pushY = 0;
      
      soldiers.current.forEach((other, otherIdx) => {
        if (index !== otherIdx) {
          const dx = soldier.x - other.x;
          const dy = soldier.y - other.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < CONSTANTS.SOLDIER_RADIUS * 2.2) {
             pushX += dx / dist;
             pushY += dy / dist;
          }
        }
      });

      const desiredY = canvas.height * 0.8 + (index % 8) * 8; 
      soldier.x += (targetX - soldier.x) * 0.2 + pushX * 1.2;
      soldier.y += (desiredY - soldier.y) * 0.2 + pushY * 1.2;
      
      // Shooting
      soldier.shootCooldown--;
      if (soldier.shootCooldown <= 0) {
        let nearest: Entity | null = null;
        let minDst = CONSTANTS.RANGE;
        if (isOverdrive) minDst *= 1.5; // Range buff

        // Find target (Boss, Barrel, or Enemy)
        const targets: Entity[] = [...barrels.current, ...enemies.current];
        if (boss.current) targets.push(boss.current);

        targets.forEach(t => {
           const dst = Math.sqrt(Math.pow(t.x - soldier.x, 2) + Math.pow(t.y - soldier.y, 2));
           if (dst < minDst && t.y < soldier.y) {
             minDst = dst;
             nearest = t;
           }
        });

        if (nearest) {
          const t = nearest as Entity;
          const angle = Math.atan2(t.y - soldier.y, t.x - soldier.x);
          
          const fireBullet = (ang: number, spd: number, dmg: number, col: string) => {
              bullets.current.push({
                id: generateId(),
                x: soldier.x,
                y: soldier.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                radius: CONSTANTS.BULLET_RADIUS,
                damage: dmg,
                isEnemy: false,
                color: col,
                markedForDeletion: false,
              });
          };

          const spread = (Math.random() - 0.5) * 0.2;
          let damage = CONSTANTS.BULLET_DAMAGE;
          let speed = CONSTANTS.BULLET_SPEED;
          let color = '#facc15'; // Yellow default

          if (isOverdrive) {
              damage *= 2;
              speed *= 1.2;
              color = '#3b82f6'; // Blue plasma in overdrive
          }
          
          if (currentWeapon.current === WeaponType.SPREAD) {
             fireBullet(angle, speed, damage, isOverdrive ? '#60a5fa' : '#a855f7');
             fireBullet(angle - 0.2, speed, damage, isOverdrive ? '#60a5fa' : '#a855f7');
             fireBullet(angle + 0.2, speed, damage, isOverdrive ? '#60a5fa' : '#a855f7');
          } else if (currentWeapon.current === WeaponType.RAPID) {
             fireBullet(angle + spread, speed * 1.5, damage * 0.7, isOverdrive ? '#60a5fa' : '#facc15');
          } else {
             fireBullet(angle + spread, speed, damage, color);
          }

          let cooldown = CONSTANTS.FIRE_RATE + Math.random() * 20;
          if (currentWeapon.current === WeaponType.RAPID) cooldown /= 3;
          if (currentWeapon.current === WeaponType.SPREAD) cooldown *= 1.2;
          if (isOverdrive) cooldown /= 2; // Insane fire rate
          
          soldier.shootCooldown = cooldown;
          
          if (Math.random() > 0.95) playSound('shoot'); 
        }
      }
    });

    // 2. Move Enemies & PowerUps
    enemies.current.forEach(enemy => {
        enemy.y += enemy.speed;
        // Enemies track the player group center
        enemy.x += (targetX - enemy.x) * 0.03; 
        if (enemy.y > canvas.height + 50) enemy.markedForDeletion = true;
    });

    const moveEntityDown = (e: Entity) => {
      e.y += worldSpeed.current;
      if (e.y > canvas.height + 100) e.markedForDeletion = true;
    };
    bullets.current.forEach(b => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.y < -100 || b.y > canvas.height + 100 || b.x < 0 || b.x > canvas.width) b.markedForDeletion = true;
    });
    
    barrels.current.forEach(moveEntityDown);
    gates.current.forEach(moveEntityDown);
    obstacles.current.forEach(moveEntityDown);
    powerUps.current.forEach(p => {
        moveEntityDown(p);
        p.life--;
        if (p.life <= 0) p.markedForDeletion = true;
    });

    // 4. Collision Logic
    
    // Bullet Collisions
    bullets.current.forEach(bullet => {
        if (bullet.markedForDeletion) return;

        if (bullet.isEnemy) {
            // Enemy bullet hits Soldier
            soldiers.current.forEach(s => {
                if (s.markedForDeletion) return;
                const dist = Math.hypot(s.x - bullet.x, s.y - bullet.y);
                if (dist < s.radius + bullet.radius) {
                    if (!godMode.current) s.markedForDeletion = true;
                    bullet.markedForDeletion = true;
                    createExplosion(s.x, s.y, CONSTANTS.SOLDIER_COLOR, 5);
                    playSound('damage');
                    shakeScreen(2);
                    // Reset combo on hit
                    comboCounter.current = 0;
                    setCombo(0);
                    if (Math.random() > 0.8) triggerTaunt(s.x, s.y, false);
                }
            });
        } else {
            // Player bullet hits Targets
            // vs Barrels
            barrels.current.forEach(barrel => {
                if (barrel.markedForDeletion) return;
                if (Math.hypot(barrel.x - bullet.x, barrel.y - bullet.y) < barrel.radius + bullet.radius) {
                    bullet.markedForDeletion = true;
                    barrel.hp -= bullet.damage;
                    createExplosion(bullet.x, bullet.y, '#facc15', 1, 5);
                    if (barrel.hp <= 0) {
                        barrel.markedForDeletion = true;
                        createExplosion(barrel.x, barrel.y, CONSTANTS.BARREL_COLOR, 10);
                        createFloatingText(barrel.x, barrel.y, `+${barrel.value}`, '#fbbf24', 1.5);
                        scoreRef.current += barrel.value;
                        addCombo(1);
                        playSound('explosion');
                        shakeScreen(5);
                        spawnPowerUp(barrel.x, barrel.y);
                    }
                }
            });

            // vs Enemies
            enemies.current.forEach(enemy => {
                if (enemy.markedForDeletion) return;
                if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + bullet.radius) {
                    bullet.markedForDeletion = true;
                    enemy.hp -= bullet.damage / 10; // Soldiers take a few hits now
                    if (enemy.hp <= 0) {
                        enemy.markedForDeletion = true; 
                        createExplosion(enemy.x, enemy.y, '#ef4444', 5);
                        createFloatingText(enemy.x, enemy.y, "+10", '#ef4444');
                        scoreRef.current += 10;
                        addCombo(1);
                        playSound('explosion');
                        spawnPowerUp(enemy.x, enemy.y);
                    } else {
                        createExplosion(enemy.x, enemy.y, '#ef4444', 1, 2);
                    }
                }
            });

            // vs Boss
            if (boss.current && !boss.current.markedForDeletion) {
                const b = boss.current;
                if (bullet.x > b.x - b.width/2 && bullet.x < b.x + b.width/2 && 
                    bullet.y > b.y - b.height/2 && bullet.y < b.y + b.height/2) {
                        bullet.markedForDeletion = true;
                        b.hp -= bullet.damage;
                        createExplosion(bullet.x, bullet.y, b.type === BossType.THE_ALGORITHM ? '#00ff00' : '#ef4444', 2, 10);
                        if (Math.random() > 0.8) playSound('damage');
                }
            }
        }
    });

    // Soldier Collisions
    soldiers.current.forEach(s => {
        if (s.markedForDeletion) return;

        // vs Enemies (Kamikaze)
        enemies.current.forEach(e => {
            if (e.markedForDeletion) return;
            if (Math.hypot(s.x - e.x, s.y - e.y) < s.radius + e.radius) {
                if (!godMode.current) s.markedForDeletion = true;
                e.markedForDeletion = true;
                createExplosion(s.x, s.y, '#ef4444', 8);
                shakeScreen(5);
                playSound('damage');
                comboCounter.current = 0;
                setCombo(0);
            }
        });

        // vs Obstacles
        obstacles.current.forEach(o => {
            if (s.x > o.x - o.width/2 && s.x < o.x + o.width/2 && Math.abs(s.y - o.y) < 20) {
                if (!godMode.current) s.markedForDeletion = true;
                createExplosion(s.x, s.y, '#ef4444', 5);
                playSound('damage');
                if (o.type === 'SPIKE') triggerPunishment();
                if (o.type === 'PAYWALL') {
                    createFloatingText(s.x, s.y, "PAY ME", '#fbbf24', 2);
                    shakeScreen(5);
                }
            }
        });

        // vs Barrels (Crash)
        barrels.current.forEach(b => {
             if (Math.hypot(s.x - b.x, s.y - b.y) < s.radius + b.radius) {
                 if (!godMode.current) s.markedForDeletion = true;
                 b.hp -= 20; 
                 createExplosion(s.x, s.y, '#ef4444', 5);
                 shakeScreen(2);
                 playSound('damage');
             }
        });
        
        // vs PowerUps
        powerUps.current.forEach(p => {
            if (p.markedForDeletion) return;
            if (Math.hypot(s.x - p.x, s.y - p.y) < s.radius + p.radius + 10) {
                p.markedForDeletion = true;
                currentWeapon.current = p.type;
                weaponTimer.current = CONSTANTS.WEAPON_DURATION;
                playSound('powerup');
                createFloatingText(p.x, p.y, p.type, p.color, 2);
                createExplosion(p.x, p.y, p.color, 15, 15);
            }
        });
    });

    // Gate Logic
    gates.current.forEach(gate => {
       const gateLeft = gate.x - gate.width / 2;
       const gateRight = gate.x + gate.width / 2;
       if (gate.y > canvas.height * 0.8 && gate.y < canvas.height * 0.8 + 50) {
           const hit = soldiers.current.some(s => s.x > gateLeft && s.x < gateRight);
           
           if (hit && !gate.markedForDeletion) {
               gate.markedForDeletion = true;
               playSound('gate');
               flashScreen(0.3);
               
               const currentCount = soldiers.current.length;
               let newCount = currentCount;
               
               // Punishment logic for negative gates
               if (gate.type === GateType.SUBTRACT || gate.type === GateType.DIVIDE) {
                   triggerPunishment();
               }

               if (gate.type === GateType.ADD) newCount += gate.value;
               if (gate.type === GateType.SUBTRACT) newCount = Math.max(0, newCount - gate.value);
               if (gate.type === GateType.MULTIPLY) newCount = Math.floor(newCount * gate.value);
               if (gate.type === GateType.DIVIDE) newCount = Math.floor(newCount / gate.value);
               
               newCount = Math.min(newCount, 500); 
               const diff = newCount - currentCount;

               if (diff > 0) {
                   createFloatingText(gate.x, gate.y, `x${gate.value} ARMY!`, '#4ade80', 2);
                   createExplosion(gate.x, gate.y, '#4ade80', 20, 15);
                   for(let i=0; i<diff; i++) {
                       soldiers.current.push(createSoldier(
                           Math.max(gateLeft, Math.min(gateRight, randomRange(gateLeft, gateRight))),
                           randomRange(gate.y - 50, gate.y + 50)
                       ));
                   }
               } else {
                   createFloatingText(gate.x, gate.y, `FATAL ERROR`, '#ef4444', 2);
                   createExplosion(gate.x, gate.y, '#ef4444', 20, 20);
                   for(let i=0; i<Math.abs(diff); i++) {
                       if (soldiers.current[i] && !godMode.current) soldiers.current[i].markedForDeletion = true;
                   }
               }
           }
       }
    });

    // Cleanup
    soldiers.current = soldiers.current.filter(e => !e.markedForDeletion);
    enemies.current = enemies.current.filter(e => !e.markedForDeletion);
    bullets.current = bullets.current.filter(e => !e.markedForDeletion);
    barrels.current = barrels.current.filter(e => !e.markedForDeletion);
    gates.current = gates.current.filter(e => !e.markedForDeletion);
    obstacles.current = obstacles.current.filter(e => !e.markedForDeletion);
    powerUps.current = powerUps.current.filter(e => !e.markedForDeletion);

    setSoldierCount(soldiers.current.length);
    setScore(scoreRef.current);

    if (soldiers.current.length === 0) {
        stopMusic();
        playSound('damage');
        setGameState(GameState.GAME_OVER);
    }

    // Update FX
    particles.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        if (p.life <= 0) p.markedForDeletion = true;
    });
    particles.current = particles.current.filter(p => !p.markedForDeletion);

    floatingTexts.current.forEach(t => {
        t.y += t.vy;
        t.life -= 0.02;
    });
    floatingTexts.current = floatingTexts.current.filter(t => t.life > 0);
    
    shakeIntensity.current *= 0.9;
    if (shakeIntensity.current < 0.5) shakeIntensity.current = 0;
    flashIntensity.current *= 0.85;
  };

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Handle Shake
    ctx.save();
    if (shakeIntensity.current > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensity.current;
        const dy = (Math.random() - 0.5) * shakeIntensity.current;
        ctx.translate(dx, dy);
    }

    // Background
    ctx.fillStyle = '#0f172a'; 
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40); 
    
    // Speed Lines (Juice)
    const offset = (distanceTraveled.current % 100);
    const isOverdrive = comboCounter.current >= CONSTANTS.OVERDRIVE_THRESHOLD || godMode.current;
    const isCorrupted = punishmentTimer.current > 0;

    ctx.strokeStyle = isCorrupted ? 'rgba(239, 68, 68, 0.1)' : isOverdrive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)';
    ctx.lineWidth = isOverdrive ? 4 : 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const x = (frames.current * (isOverdrive ? 30 : 10) + i * 100) % canvas.width;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();

    // Floor stripes
    ctx.fillStyle = isCorrupted ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.03)';
    for (let i = -100; i < canvas.height + 100; i += 50) {
        const y = i + offset;
        ctx.fillRect(0, y, canvas.width, 2);
    }
    
    // Draw Shadows
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    [...soldiers.current, ...enemies.current, ...barrels.current, ...powerUps.current].forEach(e => {
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.radius, e.radius, e.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    if (boss.current) {
        ctx.beginPath();
        ctx.ellipse(boss.current.x, boss.current.y + boss.current.height/2, boss.current.width/2, boss.current.height * 0.2, 0, 0, Math.PI*2);
        ctx.fill();
    }

    // Ultimate Beam
    if (ultimateActiveTimer.current > 0) {
        ctx.save();
        const width = CONSTANTS.ULTIMATE_WIDTH + Math.sin(frames.current) * 10;
        // Core
        const beamX = punishmentTimer.current > 0 ? canvas.width - mouseX.current : mouseX.current;

        ctx.fillStyle = '#dbeafe';
        ctx.fillRect(beamX - width/2, 0, width, canvas.height);
        // Glow
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 40;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.fillRect(beamX - width, 0, width * 2, canvas.height);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Gates
    gates.current.forEach(gate => {
        ctx.fillStyle = gate.color === '#3b82f6' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(gate.x - gate.width/2, -1000, gate.width, canvas.height + 2000); 
        
        ctx.fillStyle = gate.color;
        ctx.fillRect(gate.x - gate.width/2, gate.y, gate.width, gate.height);
        
        ctx.shadowColor = gate.color;
        ctx.shadowBlur = 20;
        ctx.font = `900 30px ${CONSTANTS.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        const symbol = gate.type === GateType.MULTIPLY ? 'x' : gate.type === GateType.DIVIDE ? '÷' : gate.type === GateType.ADD ? '+' : '-';
        ctx.fillText(`${symbol}${gate.value}`, gate.x, gate.y - 20);
        ctx.shadowBlur = 0;
    });

    // Obstacles
    obstacles.current.forEach(obs => {
        if (obs.type === 'SPIKE') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(obs.x - obs.width/2, obs.y, obs.width, 10);
            ctx.fillStyle = '#94a3b8';
            const spikeCount = Math.floor(obs.width / 10);
            for(let i=0; i<spikeCount; i++) {
                const sx = (obs.x - obs.width/2) + i * 10;
                ctx.beginPath();
                ctx.moveTo(sx, obs.y);
                ctx.lineTo(sx + 5, obs.y - 15);
                ctx.lineTo(sx + 10, obs.y);
                ctx.fill();
            }
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.strokeRect(obs.x - obs.width/2 - 2, obs.y - 20, obs.width + 4, 30);
        } else if (obs.type === 'PAYWALL') {
             ctx.fillStyle = '#fbbf24';
             ctx.fillRect(obs.x - obs.width/2, obs.y, obs.width, 20);
             ctx.fillStyle = '#000';
             ctx.font = 'bold 12px sans-serif';
             ctx.textAlign = 'center';
             ctx.fillText("$ PAYWALL $", obs.x, obs.y + 15);
        }
    });

    // PowerUps
    powerUps.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        ctx.fill();
        // Icon
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type === WeaponType.SPREAD ? 'S' : 'R', p.x, p.y);
        ctx.shadowBlur = 0;
    });

    // Barrels
    barrels.current.forEach(b => {
        ctx.fillStyle = CONSTANTS.BARREL_COLOR;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold 12px ${CONSTANTS.FONT_FAMILY}`;
        ctx.fillText(b.hp.toString(), b.x, b.y + 4);
    });

    // Enemies
    enemies.current.forEach(e => {
        ctx.fillStyle = CONSTANTS.ENEMY_COLOR;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(e.x - 3, e.y - 2, 2, 2);
        ctx.fillRect(e.x + 1, e.y - 2, 2, 2);
    });

    // Boss
    if (boss.current) {
        const b = boss.current;
        ctx.save();
        ctx.translate(b.x, b.y);
        const floatY = Math.sin(frames.current * 0.05) * 5;
        ctx.translate(0, floatY);

        if (b.type === BossType.SIEGE_BREAKER) {
            // Render existing tanky boss
             // Hull
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 20;
            ctx.fillStyle = b.type === BossType.SIEGE_BREAKER ? '#7f1d1d' : '#1f2937'; 
            const w = b.width / 2;
            const h = b.height / 2;
            ctx.beginPath();
            ctx.moveTo(-w + 10, -h);
            ctx.lineTo(w - 10, -h);
            ctx.lineTo(w, -h + 20);
            ctx.lineTo(w, h - 20);
            ctx.lineTo(w - 20, h);
            ctx.lineTo(-w + 20, h);
            ctx.lineTo(-w, h - 20);
            ctx.lineTo(-w, -h + 20);
            ctx.closePath();
            ctx.fill();
            
            // Detail
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(-w + 15, -h + 15, b.width - 30, b.height - 30);
            
            // Core
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();

            // Turrets
            const gunOffset = w + 5;
            const drawTurret = (x: number, y: number) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.fillStyle = '#171717';
                ctx.beginPath();
                ctx.arc(0, 0, 18, 0, Math.PI*2);
                ctx.fill();
                ctx.rotate(frames.current * 0.2);
                ctx.fillStyle = '#525252';
                for(let i=0; i<4; i++) {
                    ctx.fillRect(-4, -18, 8, 10);
                    ctx.rotate(Math.PI/2);
                }
                ctx.restore();
            };
            drawTurret(-gunOffset, 20);
            drawTurret(gunOffset, 20);

        } else if (b.type === BossType.THE_ALGORITHM) {
            // Wireframe Green Cube/Pyramid
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 15;
            
            const size = b.width / 2;
            ctx.save();
            ctx.rotate(frames.current * 0.02);
            ctx.strokeRect(-size/2, -size/2, size, size);
            ctx.restore();
            
            ctx.save();
            ctx.rotate(-frames.current * 0.03);
            ctx.strokeRect(-size, -size, size*2, size*2);
            ctx.restore();

            // Glitchy text
            ctx.fillStyle = '#00ff00';
            ctx.font = '10px monospace';
            ctx.fillText(Math.random().toString(2).substring(2,8), size, -size);

        } else if (b.type === BossType.THE_MONETIZER) {
            // Golden Slot Machine Look
            const w = b.width/1.5;
            const h = b.height;
            
            ctx.fillStyle = '#fbbf24'; // Gold
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10;
            ctx.fillRect(-w/2, -h/2, w, h);
            
            // Slots
            ctx.fillStyle = '#000';
            ctx.fillRect(-w/2 + 5, -h/4, w - 10, h/2);
            
            // Symbols
            ctx.font = '20px sans-serif';
            const symbols = ['7', '$', '🍒', '💎'];
            const s1 = symbols[Math.floor((frames.current / 10) % symbols.length)];
            const s2 = symbols[Math.floor((frames.current / 8) % symbols.length)];
            const s3 = symbols[Math.floor((frames.current / 12) % symbols.length)];
            
            ctx.fillStyle = '#fff';
            ctx.fillText(`${s1} ${s2} ${s3}`, -w/2 + 10, 5);
        }

        ctx.restore();

        // Boss UI (Shared)
        ctx.save();
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillStyle = CONSTANTS.BOSS_CONFIGS[b.type].color;
        ctx.font = `900 18px ${CONSTANTS.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(CONSTANTS.BOSS_CONFIGS[b.type].name, b.x, b.y - b.height/2 - 40);
        
        const hpRatio = b.hp / b.maxHp;
        const barW = 160;
        const barH = 12;
        const barX = b.x - barW/2;
        const barY = b.y - b.height/2 - 30;
        ctx.fillStyle = '#1f2937'; 
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.fillStyle = hpRatio < 0.3 ? '#ef4444' : CONSTANTS.BOSS_CONFIGS[b.type].color; 
        ctx.beginPath();
        ctx.roundRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * hpRatio), barH - 2, 3);
        ctx.fill();
        ctx.restore();
    }

    // Soldiers
    soldiers.current.forEach(s => {
        ctx.fillStyle = godMode.current ? '#fff' : CONSTANTS.SOLDIER_COLOR;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2);
        ctx.fill();
        if (isOverdrive) {
            ctx.shadowColor = godMode.current ? '#fff' : '#60a5fa';
            ctx.shadowBlur = 5;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(s.x - 1, s.y - 1, s.radius/2, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Bullets
    bullets.current.forEach(b => {
        const bulletColor = b.color || (b.isEnemy ? '#ef4444' : '#facc15');
        ctx.fillStyle = bulletColor;
        ctx.shadowColor = bulletColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Particles
    particles.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Floating Text
    floatingTexts.current.forEach(t => {
        ctx.globalAlpha = t.life;
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.scale, t.scale);
        ctx.fillStyle = t.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.font = `900 24px ${CONSTANTS.FONT_FAMILY}`;
        ctx.strokeText(t.text, 0, 0);
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
    });
    ctx.globalAlpha = 1.0;

    // Screen Flash / Glitch
    if (flashIntensity.current > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity.current})`;
        ctx.fillRect(-100, -100, canvas.width + 200, canvas.height + 200);
    }

    // GLITCH OVERLAY
    if (punishmentTimer.current > 0) {
        // RGB Split Effect
        ctx.fillStyle = `rgba(255, 0, 0, 0.1)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Scanlines
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for(let i=0; i<canvas.height; i+=4) {
            ctx.fillRect(0, i, canvas.width, 1);
        }

        // Static Noise text
        ctx.fillStyle = 'white';
        ctx.font = '40px monospace';
        ctx.textAlign = 'center';
        if (Math.random() > 0.8) ctx.fillText("SYSTEM ERROR", canvas.width/2 + Math.random()*10, canvas.height/2 + Math.random()*10);
    }

    ctx.restore(); // End Shake
  };

  // --- Lifecycle & Inputs ---
  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      let clientX = 0;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
      } else {
        clientX = (e as MouseEvent).clientX;
      }
      const scaleX = canvasRef.current.width / rect.width;
      mouseX.current = (clientX - rect.left) * scaleX;
    }
  }, []);

  // KONAMI CODE LISTENER
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === CONSTANTS.KONAMI_CODE[konamiIndex.current]) {
              konamiIndex.current++;
              if (konamiIndex.current === CONSTANTS.KONAMI_CODE.length) {
                  godMode.current = !godMode.current;
                  playSound('powerup');
                  setSystemStatus(godMode.current ? 'OVERDRIVE' : 'STABLE');
                  konamiIndex.current = 0;
                  if (godMode.current) {
                      setUltimateCharge(CONSTANTS.ULTIMATE_MAX_CHARGE);
                      if(canvasRef.current) {
                        createFloatingText(canvasRef.current.width/2, canvasRef.current.height/2, "DEV GOD MODE ENABLED", '#fff', 3);
                      }
                  }
              }
          } else {
              konamiIndex.current = 0;
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSystemStatus, setUltimateCharge]);

  useEffect(() => {
    if (gameState === GameState.MENU) return;
    if (gameState === GameState.PLAYING) {
        if (soldiers.current.length === 0) initGame();
    }

    const loop = () => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
           ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
           update(canvasRef.current);
           draw(ctx, canvasRef.current);
        }
      }
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, triggerUltimate]);

  useEffect(() => {
     const handleResize = () => {
        if (canvasRef.current && canvasRef.current.parentElement) {
            canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
            canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
            if (gameState === GameState.MENU) initGame();
        }
     };
     window.addEventListener('resize', handleResize);
     handleResize();
     return () => window.removeEventListener('resize', handleResize);
  }, [gameState]);

  useEffect(() => {
      const canvas = canvasRef.current;
      if(!canvas) return;
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('touchmove', handleMouseMove, { passive: false });
      canvas.addEventListener('touchstart', handleMouseMove, { passive: false });
      return () => {
          canvas.removeEventListener('mousemove', handleMouseMove);
          canvas.removeEventListener('touchmove', handleMouseMove);
          canvas.removeEventListener('touchstart', handleMouseMove);
      }
  }, [handleMouseMove]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full touch-none cursor-crosshair"
    />
  );
};

export default GameEngine;
