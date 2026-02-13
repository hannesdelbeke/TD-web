import Phaser from "phaser";
import "./style.css";

type TargetMode = "first" | "last" | "nearest" | "strongest" | "weakest";
type EnemyType = "basic" | "fast" | "tank" | "armored";
type RenderLod = "detail" | "lite" | "cluster";

interface Tile {
  buildable: boolean;
  blocked: boolean;
  path: boolean;
}

interface EnemySimState {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  progress: number;
  alive: boolean;
  hitFlash: number;
  x: number;
  y: number;
}

interface EnemyRenderStyleDef {
  color: number;
  size: number;
  shape: "circle" | "triangle" | "square" | "diamond";
}

interface RenderLODPolicy {
  detailMax: number;
  liteMax: number;
}

interface TowerDef {
  name: string;
  color: number;
  cost: number;
  range: number;
  damage: number;
  fireRate: number;
}

interface Tower {
  id: number;
  cellX: number;
  cellY: number;
  x: number;
  y: number;
  level: number;
  targetMode: TargetMode;
  cooldown: number;
  defKey: keyof typeof TOWER_DEFS;
  sprite: Phaser.GameObjects.Rectangle;
}

interface WaveDef {
  count: number;
  hp: number;
  speed: number;
  reward: number;
  spawnInterval: number;
}

interface ShotFx {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  ttl: number;
  maxTtl: number;
  color: number;
}

interface BurstFx {
  x: number;
  y: number;
  ttl: number;
  maxTtl: number;
  color: number;
  radius: number;
}

interface EnemyArchetypeDef {
  hpMul: number;
  speedMul: number;
  rewardMul: number;
}

interface FieldState {
  id: number;
  name: string;
  towers: Tower[];
  enemies: EnemySimState[];
  shotFx: ShotFx[];
  burstFx: BurstFx[];
  nextEnemyId: number;
  nextTowerId: number;
  currentWaveIndex: number;
  spawnedInWave: number;
  spawnTimer: number;
  interWaveTimer: number;
  selectedTowerType: keyof typeof TOWER_DEFS;
  selectedTowerId: number | null;
  gold: number;
  baseHp: number;
  maxBaseHp: number;
  gameSpeed: number;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
}

interface SavedTowerState {
  id: number;
  cellX: number;
  cellY: number;
  level: number;
  targetMode: TargetMode;
  cooldown: number;
  defKey: keyof typeof TOWER_DEFS;
}

interface SavedEnemyState {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  progress: number;
  alive: boolean;
  hitFlash: number;
}

interface SavedFieldState {
  id: number;
  name: string;
  nextEnemyId: number;
  nextTowerId: number;
  currentWaveIndex: number;
  spawnedInWave: number;
  spawnTimer: number;
  interWaveTimer: number;
  selectedTowerType: keyof typeof TOWER_DEFS;
  selectedTowerId: number | null;
  gold: number;
  baseHp: number;
  maxBaseHp: number;
  gameSpeed: number;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
  towers: SavedTowerState[];
  enemies: SavedEnemyState[];
}

interface SavedGameState {
  version: number;
  savedAt: number;
  activeFieldIndex: number;
  fields: SavedFieldState[];
}

interface SessionButton {
  index: number;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

const TILE_SIZE = 56;
const GRID_COLS = 14;
const GRID_ROWS = 8;
const BOARD_X = 20;
const BOARD_Y = 20;
const PANEL_WIDTH = 290;
const GAME_WIDTH = BOARD_X * 2 + GRID_COLS * TILE_SIZE + PANEL_WIDTH;
const GAME_HEIGHT = BOARD_Y * 2 + GRID_ROWS * TILE_SIZE;

const SESSION_COUNT = 3;
const SAVE_KEY = "tdweb:multisession:v1";
const SAVE_VERSION = 1;
const AUTO_SAVE_INTERVAL_SECONDS = 2;

const TOWER_DEFS = {
  gunner: { name: "Gunner", color: 0x52c3ff, cost: 50, range: 130, damage: 14, fireRate: 1.2 },
  blaster: { name: "Blaster", color: 0xff9f43, cost: 75, range: 95, damage: 26, fireRate: 0.75 },
  sniper: { name: "Sniper", color: 0xd6f16f, cost: 110, range: 215, damage: 58, fireRate: 0.35 }
} satisfies Record<string, TowerDef>;

const ENEMY_RENDER_STYLES: Record<EnemyType, EnemyRenderStyleDef> = {
  basic: { color: 0xce6179, size: 10, shape: "circle" },
  fast: { color: 0xffad54, size: 9, shape: "triangle" },
  tank: { color: 0x7ea6ff, size: 12, shape: "square" },
  armored: { color: 0xc2d36a, size: 11, shape: "diamond" }
};

const ENEMY_ARCHETYPES: Record<EnemyType, EnemyArchetypeDef> = {
  basic: { hpMul: 1, speedMul: 1, rewardMul: 1 },
  fast: { hpMul: 0.7, speedMul: 1.35, rewardMul: 1 },
  tank: { hpMul: 1.8, speedMul: 0.7, rewardMul: 1.35 },
  armored: { hpMul: 1.45, speedMul: 0.9, rewardMul: 1.25 }
};

const RENDER_LOD_POLICY: RenderLODPolicy = { detailMax: 140, liteMax: 260 };

const WAVES: WaveDef[] = [
  { count: 24, hp: 55, speed: 84, reward: 8, spawnInterval: 0.28 },
  { count: 42, hp: 90, speed: 95, reward: 10, spawnInterval: 0.2 },
  { count: 70, hp: 130, speed: 108, reward: 12, spawnInterval: 0.14 }
];

const TARGET_MODES: TargetMode[] = ["first", "last", "nearest", "strongest", "weakest"];

class GameScene extends Phaser.Scene {
  private tiles: Tile[][] = [];
  private pathCells: Phaser.Math.Vector2[] = [];

  private fields: FieldState[] = [];
  private activeFieldIndex = 0;

  private enemyGraphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;

  private hudText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private towerInfoText!: Phaser.GameObjects.Text;
  private hoverPreview!: Phaser.GameObjects.Rectangle;
  private rangeCircle!: Phaser.GameObjects.Arc;
  private sessionButtons: SessionButton[] = [];

  private hoverCell: Phaser.Math.Vector2 | null = null;

  private lossModal!: Phaser.GameObjects.Container;
  private lossModalVisible = false;
  private suppressWorldClickUntil = 0;

  private autoSaveTimer = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.createMap();
    this.drawBoard();
    this.createHud();
    this.createInput();
    this.initFields();
    this.syncUi();

    const onBeforeUnload = (): void => {
      this.saveGameState();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      this.saveGameState();
    });
  }

  update(time: number, deltaMs: number): void {
    const baseDelta = deltaMs / 1000;

    this.updateHoverPreview();

    for (const field of this.fields) {
      const delta = baseDelta * field.gameSpeed;
      if (!field.paused && !field.gameOver) {
        this.runWave(field, delta);
        this.updateEnemies(field, delta);
        this.updateTowers(field, delta);
        this.checkEndState(field);
      }
      this.updateFx(field, delta);
      this.cleanupEnemies(field);
    }

    const active = this.getActiveField();
    this.renderField(active, time / 1000);
    this.syncUi();

    this.autoSaveTimer += baseDelta;
    if (this.autoSaveTimer >= AUTO_SAVE_INTERVAL_SECONDS) {
      this.autoSaveTimer = 0;
      this.saveGameState();
    }
  }
  private initFields(): void {
    if (!this.tryLoadGameState()) {
      this.fields = [];
      for (let i = 0; i < SESSION_COUNT; i += 1) {
        this.fields.push(this.createEmptyField(i + 1));
      }
      this.activeFieldIndex = 0;
    }

    this.activeFieldIndex = Phaser.Math.Clamp(this.activeFieldIndex, 0, Math.max(0, this.fields.length - 1));
    this.refreshTowerVisibility();
    this.updateSessionButtons();
    this.updateLossModalVisibility();
  }

  private createEmptyField(id: number): FieldState {
    return {
      id,
      name: `Session ${id}`,
      towers: [],
      enemies: [],
      shotFx: [],
      burstFx: [],
      nextEnemyId: 1,
      nextTowerId: 1,
      currentWaveIndex: 0,
      spawnedInWave: 0,
      spawnTimer: 0,
      interWaveTimer: 1.2,
      selectedTowerType: "gunner",
      selectedTowerId: null,
      gold: 180,
      baseHp: 20,
      maxBaseHp: 20,
      gameSpeed: 1,
      paused: false,
      gameOver: false,
      victory: false
    };
  }

  private getActiveField(): FieldState {
    return this.fields[this.activeFieldIndex];
  }

  private isActiveField(field: FieldState): boolean {
    return this.getActiveField() === field;
  }

  private createMap(): void {
    this.pathCells = [
      new Phaser.Math.Vector2(0, 3),
      new Phaser.Math.Vector2(1, 3),
      new Phaser.Math.Vector2(2, 3),
      new Phaser.Math.Vector2(3, 3),
      new Phaser.Math.Vector2(4, 3),
      new Phaser.Math.Vector2(5, 3),
      new Phaser.Math.Vector2(5, 4),
      new Phaser.Math.Vector2(5, 5),
      new Phaser.Math.Vector2(6, 5),
      new Phaser.Math.Vector2(7, 5),
      new Phaser.Math.Vector2(8, 5),
      new Phaser.Math.Vector2(9, 5),
      new Phaser.Math.Vector2(10, 5),
      new Phaser.Math.Vector2(11, 5),
      new Phaser.Math.Vector2(12, 5),
      new Phaser.Math.Vector2(13, 5)
    ];

    const blockedSet = new Set(["2,1", "3,1", "9,2", "9,3", "11,1", "12,1"]);
    const pathSet = new Set(this.pathCells.map((p) => `${p.x},${p.y}`));

    this.tiles = [];
    for (let y = 0; y < GRID_ROWS; y += 1) {
      const row: Tile[] = [];
      for (let x = 0; x < GRID_COLS; x += 1) {
        const key = `${x},${y}`;
        const path = pathSet.has(key);
        const blocked = blockedSet.has(key);
        row.push({ path, blocked, buildable: !path && !blocked });
      }
      this.tiles.push(row);
    }
  }

  private drawBoard(): void {
    this.cameras.main.setBackgroundColor(0x111216);

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLS; x += 1) {
        const world = this.cellToWorld(x, y);
        const tile = this.tiles[y][x];
        const color = tile.path ? 0x37465f : tile.blocked ? 0x2b2c34 : 0x1f3f2f;
        this.add.rectangle(world.x, world.y, TILE_SIZE - 2, TILE_SIZE - 2, color).setStrokeStyle(1, 0x0d0f14, 0.9);
      }
    }

    this.enemyGraphics = this.add.graphics().setDepth(2);
    this.fxGraphics = this.add.graphics().setDepth(4);

    this.add
      .rectangle(this.getPanelLeft() + PANEL_WIDTH / 2, GAME_HEIGHT / 2, PANEL_WIDTH - 14, GAME_HEIGHT - 10, 0x161922)
      .setStrokeStyle(1, 0x2e3447);

    this.hoverPreview = this.add.rectangle(-100, -100, TILE_SIZE - 8, TILE_SIZE - 8, 0x4ae291, 0.35);
    this.rangeCircle = this.add.circle(-100, -100, 10, 0x7fd6ff, 0.12).setStrokeStyle(2, 0x7fd6ff, 0.7);

    this.createLossModal();
  }

  private createHud(): void {
    this.hudText = this.add.text(this.getPanelLeft() + 16, 24, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "14px",
      color: "#dbe2ff",
      lineSpacing: 4
    });

    this.statusText = this.add.text(this.getPanelLeft() + 16, GAME_HEIGHT - 72, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "18px",
      color: "#ffd369"
    });

    this.towerInfoText = this.add.text(this.getPanelLeft() + 16, 286, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "13px",
      color: "#bfd5ff",
      wordWrap: { width: PANEL_WIDTH - 34 }
    });

    this.createSessionButton(0, "S1", this.getPanelLeft() + 16, 128);
    this.createSessionButton(1, "S2", this.getPanelLeft() + 84, 128);
    this.createSessionButton(2, "S3", this.getPanelLeft() + 152, 128);

    this.makeButton(this.getPanelLeft() + 16, 168, "1 Gunner", () => {
      this.getActiveField().selectedTowerType = "gunner";
      this.getActiveField().selectedTowerId = null;
    });

    this.makeButton(this.getPanelLeft() + 16, 202, "2 Blaster", () => {
      this.getActiveField().selectedTowerType = "blaster";
      this.getActiveField().selectedTowerId = null;
    });

    this.makeButton(this.getPanelLeft() + 16, 236, "3 Sniper", () => {
      this.getActiveField().selectedTowerType = "sniper";
      this.getActiveField().selectedTowerId = null;
    });

    this.makeButton(this.getPanelLeft() + 16, 418, "Speed 1x", () => {
      this.getActiveField().gameSpeed = 1;
    });

    this.makeButton(this.getPanelLeft() + 16, 452, "Speed 2x", () => {
      this.getActiveField().gameSpeed = 2;
    });

    this.makeButton(this.getPanelLeft() + 16, 486, "Speed 4x", () => {
      this.getActiveField().gameSpeed = 4;
    });

    this.makeButton(this.getPanelLeft() + 16, 520, "Pause", () => {
      this.getActiveField().paused = !this.getActiveField().paused;
    });

    this.makeButton(this.getPanelLeft() + 16, 554, "Restart", () => {
      this.restartFieldAtIndex(this.activeFieldIndex);
    });
  }

  private createSessionButton(index: number, label: string, x: number, y: number): void {
    const bg = this.add
      .rectangle(x + 28, y + 12, 56, 24, 0x23314a)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x5f7aa2)
      .setInteractive({ useHandCursor: true });

    const text = this.add.text(x + 16, y + 3, label, {
      fontFamily: "Consolas, monospace",
      fontSize: "13px",
      color: "#e4ecff"
    });

    const onClick = (): void => {
      this.setActiveField(index);
    };

    bg.on("pointerdown", onClick);
    text.setInteractive({ useHandCursor: true });
    text.on("pointerdown", onClick);

    this.sessionButtons.push({ index, bg, text });
  }

  private updateSessionButtons(): void {
    for (const btn of this.sessionButtons) {
      const active = btn.index === this.activeFieldIndex;
      const field = this.fields[btn.index];
      let fill = active ? 0x3a6fb3 : 0x23314a;
      let stroke = active ? 0x90beff : 0x5f7aa2;
      if (field && field.gameOver && !field.victory) {
        fill = active ? 0x7a2a37 : 0x5e1f2b;
        stroke = 0xba4f66;
      } else if (field && field.victory) {
        fill = active ? 0x2f6d45 : 0x234f32;
        stroke = 0x68c58d;
      }
      btn.bg.setFillStyle(fill).setStrokeStyle(1, stroke);
    }
  }

  private createInput(): void {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.hoverCell = this.worldToCell(pointer.worldX, pointer.worldY);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.time.now < this.suppressWorldClickUntil) {
        return;
      }

      if (this.lossModalVisible) {
        return;
      }

      const active = this.getActiveField();
      const cell = this.worldToCell(pointer.worldX, pointer.worldY);
      if (!cell || active.gameOver || active.paused) {
        return;
      }

      if (pointer.rightButtonDown()) {
        this.trySelectTower(active, cell.x, cell.y);
        return;
      }

      const pickedTower = this.findTower(active, cell.x, cell.y);
      if (pickedTower) {
        active.selectedTowerId = pickedTower.id;
      } else {
        this.tryPlaceTower(active, cell.x, cell.y);
      }
    });

    this.input.keyboard?.on("keydown-ONE", () => {
      const field = this.getActiveField();
      field.selectedTowerType = "gunner";
      field.selectedTowerId = null;
    });
    this.input.keyboard?.on("keydown-TWO", () => {
      const field = this.getActiveField();
      field.selectedTowerType = "blaster";
      field.selectedTowerId = null;
    });
    this.input.keyboard?.on("keydown-THREE", () => {
      const field = this.getActiveField();
      field.selectedTowerType = "sniper";
      field.selectedTowerId = null;
    });

    this.input.keyboard?.on("keydown-F1", () => this.setActiveField(0));
    this.input.keyboard?.on("keydown-F2", () => this.setActiveField(1));
    this.input.keyboard?.on("keydown-F3", () => this.setActiveField(2));

    this.input.keyboard?.on("keydown-U", () => this.tryUpgradeSelected(this.getActiveField()));
    this.input.keyboard?.on("keydown-S", () => this.trySellSelected(this.getActiveField()));
    this.input.keyboard?.on("keydown-T", () => this.cycleSelectedTargetMode(this.getActiveField()));

    this.input.keyboard?.on("keydown-SPACE", () => {
      const field = this.getActiveField();
      field.paused = !field.paused;
    });

    this.input.keyboard?.on("keydown-Q", () => {
      this.getActiveField().gameSpeed = 1;
    });
    this.input.keyboard?.on("keydown-W", () => {
      this.getActiveField().gameSpeed = 2;
    });
    this.input.keyboard?.on("keydown-E", () => {
      this.getActiveField().gameSpeed = 4;
    });

    this.input.keyboard?.on("keydown-R", () => {
      this.restartFieldAtIndex(this.activeFieldIndex);
    });

    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.lossModalVisible) {
        this.handleLossConfirm();
      }
    });
  }

  private setActiveField(index: number): void {
    if (this.lossModalVisible) {
      return;
    }
    if (index < 0 || index >= this.fields.length) {
      return;
    }
    this.activeFieldIndex = index;
    this.refreshTowerVisibility();
    this.updateSessionButtons();
    this.updateLossModalVisibility();
    this.syncUi();
  }

  private runWave(field: FieldState, delta: number): void {
    const wave = this.getWaveDef(field.currentWaveIndex);
    if (field.spawnedInWave < wave.count) {
      field.spawnTimer += delta;
      while (field.spawnTimer >= wave.spawnInterval && field.spawnedInWave < wave.count) {
        field.spawnTimer -= wave.spawnInterval;
        this.spawnEnemy(field, wave);
        field.spawnedInWave += 1;
      }
      return;
    }

    if (field.enemies.length === 0) {
      field.interWaveTimer -= delta;
      if (field.interWaveTimer <= 0) {
        field.currentWaveIndex += 1;
        field.spawnedInWave = 0;
        field.spawnTimer = 0;
        field.interWaveTimer = 2;
      }
    }
  }

  private spawnEnemy(field: FieldState, wave: WaveDef): void {
    const type = this.pickEnemyType(field.currentWaveIndex);
    const archetype = ENEMY_ARCHETYPES[type];
    const hp = Math.floor(wave.hp * archetype.hpMul);
    const speed = wave.speed * archetype.speedMul;
    const reward = Math.max(1, Math.floor(wave.reward * archetype.rewardMul));
    const spawnWorld = this.cellToWorld(this.pathCells[0].x, this.pathCells[0].y);

    field.enemies.push({
      id: field.nextEnemyId++,
      type,
      hp,
      maxHp: hp,
      speed,
      reward,
      progress: 0,
      alive: true,
      hitFlash: 0,
      x: spawnWorld.x,
      y: spawnWorld.y
    });
  }

  private pickEnemyType(waveIndex: number): EnemyType {
    const roll = Math.random();
    if (waveIndex === 0) {
      return roll < 0.72 ? "basic" : "fast";
    }
    if (waveIndex === 1) {
      if (roll < 0.55) return "basic";
      if (roll < 0.8) return "fast";
      return "tank";
    }
    if (roll < 0.4) return "basic";
    if (roll < 0.62) return "fast";
    if (roll < 0.86) return "tank";
    return "armored";
  }

  private updateEnemies(field: FieldState, delta: number): void {
    const totalSegments = this.pathCells.length - 1;
    for (const enemy of field.enemies) {
      if (!enemy.alive) {
        continue;
      }

      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta * 3.4);
      enemy.progress += (enemy.speed * delta) / TILE_SIZE;

      if (enemy.progress >= totalSegments) {
        enemy.alive = false;
        field.baseHp -= 1;
        continue;
      }

      const seg = Math.floor(enemy.progress);
      const t = enemy.progress - seg;
      const a = this.pathCells[seg];
      const b = this.pathCells[seg + 1];
      const x = Phaser.Math.Linear(a.x, b.x, t);
      const y = Phaser.Math.Linear(a.y, b.y, t);
      const world = this.cellToWorld(x, y);
      enemy.x = world.x;
      enemy.y = world.y;
    }
  }

  private updateTowers(field: FieldState, delta: number): void {
    for (const tower of field.towers) {
      tower.cooldown -= delta;
      if (tower.cooldown > 0) {
        continue;
      }

      const target = this.pickTarget(field, tower, this.towerRange(tower));
      if (!target) {
        continue;
      }

      target.hp -= this.towerDamage(tower);
      target.hitFlash = 0.33;
      if (this.isActiveField(field)) {
        this.pulseTowerOnFire(tower);
      }

      field.shotFx.push({
        fromX: tower.x,
        fromY: tower.y,
        toX: target.x,
        toY: target.y,
        ttl: 0.09,
        maxTtl: 0.09,
        color: 0xfff2a6
      });

      tower.cooldown = 1 / this.towerFireRate(tower);

      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        field.gold += target.reward;

        const style = ENEMY_RENDER_STYLES[target.type];
        field.burstFx.push({
          x: target.x,
          y: target.y,
          ttl: 0.1,
          maxTtl: 0.1,
          color: style.color,
          radius: style.size + 8
        });
      }
    }
  }

  private updateFx(field: FieldState, delta: number): void {
    for (const fx of field.shotFx) {
      fx.ttl -= delta;
    }
    for (const fx of field.burstFx) {
      fx.ttl -= delta;
    }
    field.shotFx = field.shotFx.filter((fx) => fx.ttl > 0);
    field.burstFx = field.burstFx.filter((fx) => fx.ttl > 0);
  }

  private cleanupEnemies(field: FieldState): void {
    field.enemies = field.enemies.filter((enemy) => enemy.alive);
  }

  private checkEndState(field: FieldState): void {
    if (field.baseHp <= 0 && !field.gameOver) {
      field.baseHp = 0;
      field.gameOver = true;
      field.victory = false;
      if (this.isActiveField(field)) {
        this.showLossModal();
      }
      return;
    }

    // Endless mode: no victory state.
  }

  private getWaveDef(waveIndex: number): WaveDef {
    const base = WAVES[waveIndex % WAVES.length];
    const cycle = Math.floor(waveIndex / WAVES.length);
    const hpScale = 1 + cycle * 0.2;
    const speedScale = 1 + cycle * 0.05;
    const countScale = 1 + cycle * 0.12;
    const rewardScale = 1 + cycle * 0.12;
    const spawnScale = Math.max(0.45, 1 - cycle * 0.05);

    return {
      count: Math.floor(base.count * countScale),
      hp: Math.floor(base.hp * hpScale),
      speed: base.speed * speedScale,
      reward: Math.max(1, Math.floor(base.reward * rewardScale)),
      spawnInterval: base.spawnInterval * spawnScale
    };
  }

  private tryPlaceTower(field: FieldState, cellX: number, cellY: number): void {
    if (!this.isInsideGrid(cellX, cellY)) {
      return;
    }
    const tile = this.tiles[cellY][cellX];
    if (!tile.buildable || tile.blocked || tile.path) {
      return;
    }
    if (this.findTower(field, cellX, cellY)) {
      return;
    }

    const def = TOWER_DEFS[field.selectedTowerType];
    if (field.gold < def.cost) {
      return;
    }

    field.gold -= def.cost;

    const world = this.cellToWorld(cellX, cellY);
    const sprite = this.createTowerSprite(field.selectedTowerType, world.x, world.y, this.isActiveField(field));
    const tower: Tower = {
      id: field.nextTowerId++,
      cellX,
      cellY,
      x: world.x,
      y: world.y,
      level: 1,
      targetMode: "first",
      cooldown: Phaser.Math.FloatBetween(0.05, 0.22),
      defKey: field.selectedTowerType,
      sprite
    };

    field.towers.push(tower);
    field.selectedTowerId = tower.id;
    this.animateTowerPlacement(tower);
  }

  private trySelectTower(field: FieldState, cellX: number, cellY: number): void {
    const tower = this.findTower(field, cellX, cellY);
    field.selectedTowerId = tower ? tower.id : null;
  }

  private tryUpgradeSelected(field: FieldState): void {
    const tower = this.getSelectedTower(field);
    if (!tower) {
      return;
    }

    const baseCost = TOWER_DEFS[tower.defKey].cost;
    const upgradeCost = Math.floor(baseCost * (0.8 + tower.level * 0.45));
    if (field.gold < upgradeCost) {
      return;
    }

    field.gold -= upgradeCost;
    tower.level += 1;
    tower.sprite.setScale(1 + (tower.level - 1) * 0.04);
  }

  private trySellSelected(field: FieldState): void {
    const tower = this.getSelectedTower(field);
    if (!tower) {
      return;
    }

    const baseCost = TOWER_DEFS[tower.defKey].cost;
    const upgradeSpend = Math.max(0, tower.level - 1) * Math.floor(baseCost * 0.9);
    const totalSpend = baseCost + upgradeSpend;
    const refund = Math.floor(totalSpend * 0.7);

    field.gold += refund;
    tower.sprite.destroy();
    field.towers = field.towers.filter((t) => t.id !== tower.id);
    field.selectedTowerId = null;
  }

  private cycleSelectedTargetMode(field: FieldState): void {
    const tower = this.getSelectedTower(field);
    if (!tower) {
      return;
    }
    const index = TARGET_MODES.indexOf(tower.targetMode);
    tower.targetMode = TARGET_MODES[(index + 1) % TARGET_MODES.length];
  }

  private pickTarget(field: FieldState, tower: Tower, range: number): EnemySimState | null {
    const candidates = field.enemies.filter((enemy) => {
      if (!enemy.alive) {
        return false;
      }
      const dist = Phaser.Math.Distance.Between(tower.x, tower.y, enemy.x, enemy.y);
      return dist <= range;
    });

    if (candidates.length === 0) {
      return null;
    }

    switch (tower.targetMode) {
      case "first":
        return candidates.reduce((a, b) => (a.progress > b.progress ? a : b));
      case "last":
        return candidates.reduce((a, b) => (a.progress < b.progress ? a : b));
      case "nearest":
        return candidates.reduce((a, b) => {
          const da = Phaser.Math.Distance.Between(tower.x, tower.y, a.x, a.y);
          const db = Phaser.Math.Distance.Between(tower.x, tower.y, b.x, b.y);
          return da < db ? a : b;
        });
      case "strongest":
        return candidates.reduce((a, b) => (a.hp > b.hp ? a : b));
      case "weakest":
        return candidates.reduce((a, b) => (a.hp < b.hp ? a : b));
      default:
        return candidates[0];
    }
  }

  private towerRange(tower: Tower): number {
    const def = TOWER_DEFS[tower.defKey];
    return def.range * (1 + (tower.level - 1) * 0.12);
  }

  private towerDamage(tower: Tower): number {
    const def = TOWER_DEFS[tower.defKey];
    return def.damage * (1 + (tower.level - 1) * 0.3);
  }

  private towerFireRate(tower: Tower): number {
    const def = TOWER_DEFS[tower.defKey];
    return def.fireRate * (1 + (tower.level - 1) * 0.08) * 5;
  }

  private getTowerOutlineColor(defKey: keyof typeof TOWER_DEFS): number {
    return this.toDarkSaturatedOutline(TOWER_DEFS[defKey].color, 0.45, 12);
  }

  private getTowerSelectedOutlineColor(defKey: keyof typeof TOWER_DEFS): number {
    return this.toDarkSaturatedOutline(TOWER_DEFS[defKey].color, 0.62, 18);
  }

  private getEnemyOutlineColor(type: EnemyType): number {
    return this.toDarkSaturatedOutline(ENEMY_RENDER_STYLES[type].color, 0.43, 10);
  }

  private toDarkSaturatedOutline(baseColor: number, scale: number, floorBoost: number): number {
    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;

    const darken = (channel: number): number => {
      if (channel === 0) {
        return 0;
      }
      return Phaser.Math.Clamp(Math.round(channel * scale + floorBoost), 0, 255);
    };

    const outR = darken(r);
    const outG = darken(g);
    const outB = darken(b);
    return (outR << 16) | (outG << 8) | outB;
  }

  private createTowerSprite(defKey: keyof typeof TOWER_DEFS, x: number, y: number, visible: boolean): Phaser.GameObjects.Rectangle {
    const def = TOWER_DEFS[defKey];
    return this.add.rectangle(x, y, TILE_SIZE - 10, TILE_SIZE - 10, def.color).setStrokeStyle(2, this.getTowerOutlineColor(defKey)).setVisible(visible);
  }

  private pulseTowerOnFire(tower: Tower): void {
    const baseScale = 1 + (tower.level - 1) * 0.04;
    this.tweens.killTweensOf(tower.sprite);
    tower.sprite.setScale(baseScale * 1.12);
    this.tweens.add({
      targets: tower.sprite,
      scaleX: baseScale,
      scaleY: baseScale,
      duration: 90,
      ease: "Quad.Out"
    });
  }

  private animateTowerPlacement(tower: Tower): void {
    const baseScale = 1 + (tower.level - 1) * 0.04;
    this.tweens.killTweensOf(tower.sprite);
    tower.sprite.setScale(baseScale * 0.7);
    this.tweens.chain({
      targets: tower.sprite,
      tweens: [
        { scaleX: baseScale * 1.1, scaleY: baseScale * 1.1, duration: 90, ease: "Back.Out" },
        { scaleX: baseScale, scaleY: baseScale, duration: 70, ease: "Quad.Out" }
      ]
    });
  }

  private findTower(field: FieldState, cellX: number, cellY: number): Tower | undefined {
    return field.towers.find((tower) => tower.cellX === cellX && tower.cellY === cellY);
  }

  private getSelectedTower(field: FieldState): Tower | undefined {
    if (field.selectedTowerId === null) {
      return undefined;
    }
    return field.towers.find((tower) => tower.id === field.selectedTowerId);
  }

  private updateHoverPreview(): void {
    const field = this.getActiveField();

    if (!this.hoverCell || !this.isInsideGrid(this.hoverCell.x, this.hoverCell.y) || field.gameOver || this.lossModalVisible) {
      this.hoverPreview.setPosition(-100, -100);
      return;
    }

    const towerAtCell = this.findTower(field, this.hoverCell.x, this.hoverCell.y);
    const tile = this.tiles[this.hoverCell.y][this.hoverCell.x];
    const placeAllowed = tile.buildable && !towerAtCell && field.gold >= TOWER_DEFS[field.selectedTowerType].cost;
    const world = this.cellToWorld(this.hoverCell.x, this.hoverCell.y);
    this.hoverPreview.setPosition(world.x, world.y);
    this.hoverPreview.setFillStyle(placeAllowed ? 0x4ae291 : 0xff5d77, 0.35);

    const selected = this.getSelectedTower(field);
    if (selected) {
      this.rangeCircle.setPosition(selected.x, selected.y);
      this.rangeCircle.radius = this.towerRange(selected);
      selected.sprite.setStrokeStyle(3, this.getTowerSelectedOutlineColor(selected.defKey));
    } else {
      this.rangeCircle.setPosition(-100, -100);
    }

    for (const tower of field.towers) {
      if (!selected || tower.id !== selected.id) {
        tower.sprite.setStrokeStyle(2, this.getTowerOutlineColor(tower.defKey));
      }
    }
  }

  private renderField(field: FieldState, t: number): void {
    this.enemyGraphics.clear();
    this.fxGraphics.clear();

    const lod = this.pickRenderLod(field.enemies.length);
    if (lod === "cluster") {
      this.renderEnemyClusters(field.enemies);
    } else {
      const simplified = lod === "lite";
      for (const enemy of field.enemies) {
        this.renderEnemyIcon(enemy, t, simplified);
      }
    }

    if (lod !== "cluster") {
      this.renderEliteHpBars(field.enemies);
    }

    this.renderFx(field);
  }

  private pickRenderLod(enemyCount: number): RenderLod {
    if (enemyCount <= RENDER_LOD_POLICY.detailMax) {
      return "detail";
    }
    if (enemyCount <= RENDER_LOD_POLICY.liteMax) {
      return "lite";
    }
    return "cluster";
  }

  private renderEnemyIcon(enemy: EnemySimState, t: number, simplified: boolean): void {
    const style = ENEMY_RENDER_STYLES[enemy.type];
    const pulse = simplified ? 1 : 1 + Math.sin(t * 7 + enemy.id * 0.37) * 0.07;
    const wobbleX = simplified ? 0 : Math.cos(t * 10 + enemy.id) * 0.8;
    const wobbleY = simplified ? 0 : Math.sin(t * 9 + enemy.id * 0.7) * 0.8;
    const size = style.size * pulse;
    const fillColor = enemy.hitFlash > 0 ? 0xfff2cf : style.color;

    this.enemyGraphics.fillStyle(fillColor, simplified ? 0.85 : 0.96);
    this.drawEnemyShape(this.enemyGraphics, style.shape, enemy.x + wobbleX, enemy.y + wobbleY, size);

    if (!simplified) {
      this.enemyGraphics.lineStyle(2, this.getEnemyOutlineColor(enemy.type), 0.85);
      this.drawEnemyOutline(this.enemyGraphics, style.shape, enemy.x + wobbleX, enemy.y + wobbleY, size);
    }
  }

  private renderEnemyClusters(enemies: EnemySimState[]): void {
    const groups = new Map<string, { type: EnemyType; count: number; xSum: number; ySum: number }>();
    for (const enemy of enemies) {
      const segment = Math.floor(enemy.progress);
      const bucket = Math.floor((enemy.progress - segment) * 3);
      const key = `${enemy.type}-${segment}-${bucket}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.xSum += enemy.x;
        existing.ySum += enemy.y;
      } else {
        groups.set(key, { type: enemy.type, count: 1, xSum: enemy.x, ySum: enemy.y });
      }
    }

    for (const group of groups.values()) {
      const style = ENEMY_RENDER_STYLES[group.type];
      const x = group.xSum / group.count;
      const y = group.ySum / group.count;
      const radius = Math.min(28, style.size + Math.sqrt(group.count) * 2.4);
      const alpha = Math.min(0.82, 0.35 + group.count * 0.02);

      this.enemyGraphics.fillStyle(style.color, alpha);
      this.enemyGraphics.fillCircle(x, y, radius);
      this.enemyGraphics.lineStyle(2, this.getEnemyOutlineColor(group.type), 0.72);
      this.enemyGraphics.strokeCircle(x, y, radius);

      if (group.count >= 8) {
        this.enemyGraphics.fillStyle(0x10141b, 0.6);
        this.enemyGraphics.fillCircle(x, y, radius * 0.45);
      }
    }
  }

  private renderEliteHpBars(enemies: EnemySimState[]): void {
    const elite = enemies.filter((enemy) => enemy.type === "tank" || enemy.type === "armored");
    for (const enemy of elite) {
      const hpRatio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
      this.enemyGraphics.fillStyle(0x1a1c22, 0.8);
      this.enemyGraphics.fillRect(enemy.x - 12, enemy.y - 15, 24, 3);
      this.enemyGraphics.fillStyle(hpRatio > 0.4 ? 0x5af26d : 0xff6b6b, 0.95);
      this.enemyGraphics.fillRect(enemy.x - 12, enemy.y - 15, 24 * hpRatio, 3);
    }
  }

  private renderFx(field: FieldState): void {
    for (const fx of field.shotFx) {
      const alpha = Phaser.Math.Clamp(fx.ttl / fx.maxTtl, 0, 1);
      this.fxGraphics.lineStyle(2, fx.color, 0.35 + alpha * 0.5);
      this.fxGraphics.lineBetween(fx.fromX, fx.fromY, fx.toX, fx.toY);
    }

    for (const fx of field.burstFx) {
      const ratio = 1 - Phaser.Math.Clamp(fx.ttl / fx.maxTtl, 0, 1);
      const radius = fx.radius * (0.45 + ratio);
      const alpha = Phaser.Math.Clamp(1 - ratio, 0, 1);
      this.fxGraphics.fillStyle(fx.color, alpha * 0.5);
      this.fxGraphics.fillCircle(fx.x, fx.y, radius);
      this.fxGraphics.lineStyle(1, 0xfffbf0, alpha * 0.65);
      this.fxGraphics.strokeCircle(fx.x, fx.y, radius);
    }
  }

  private drawEnemyShape(graphics: Phaser.GameObjects.Graphics, shape: EnemyRenderStyleDef["shape"], x: number, y: number, size: number): void {
    switch (shape) {
      case "circle":
        graphics.fillCircle(x, y, size);
        return;
      case "triangle":
        graphics.fillTriangle(x, y - size, x - size, y + size * 0.85, x + size, y + size * 0.85);
        return;
      case "square":
        graphics.fillRect(x - size, y - size, size * 2, size * 2);
        return;
      case "diamond":
        graphics.fillTriangle(x, y - size, x - size, y, x, y + size);
        graphics.fillTriangle(x, y - size, x + size, y, x, y + size);
        return;
      default:
        graphics.fillCircle(x, y, size);
    }
  }

  private drawEnemyOutline(graphics: Phaser.GameObjects.Graphics, shape: EnemyRenderStyleDef["shape"], x: number, y: number, size: number): void {
    switch (shape) {
      case "circle":
        graphics.strokeCircle(x, y, size);
        return;
      case "triangle":
        graphics.strokeTriangle(x, y - size, x - size, y + size * 0.85, x + size, y + size * 0.85);
        return;
      case "square":
        graphics.strokeRect(x - size, y - size, size * 2, size * 2);
        return;
      case "diamond":
        graphics.strokeTriangle(x, y - size, x - size, y, x, y + size);
        graphics.strokeTriangle(x, y - size, x + size, y, x, y + size);
        return;
      default:
        graphics.strokeCircle(x, y, size);
    }
  }

  private syncUi(): void {
    const field = this.getActiveField();
    const waveLabel = `${field.currentWaveIndex + 1}`;
    const selectedDef = TOWER_DEFS[field.selectedTowerType];
    const lod = this.pickRenderLod(field.enemies.length);

    const sessionSummary = this.fields
      .map((f, i) => {
        const marker = i === this.activeFieldIndex ? "*" : " ";
        const state = f.gameOver ? (f.victory ? "WIN" : "DEAD") : `HP ${f.baseHp}`;
        return `${marker}${f.name}: ${state}`;
      })
      .join("\n");

    this.hudText.setText([
      `${field.name}`,
      `Gold: ${field.gold}`,
      `Base HP: ${field.baseHp}/${field.maxBaseHp}`,
      `Wave: ${waveLabel}`,
      `Enemies: ${field.enemies.length}`,
      `Render LOD: ${lod}`,
      `Speed: ${field.gameSpeed}x ${field.paused ? "(Paused)" : ""}`,
      "",
      `Selected build: ${selectedDef.name} (${selectedDef.cost}g)`,
      "Hotkeys: 1/2/3 build, U upgrade, S sell",
      "T target, Q/W/E speed, Space pause, R restart",
      "F1/F2/F3 switch sessions",
      "",
      sessionSummary
    ]);

    if (field.gameOver && field.victory) {
      this.statusText.setText("VICTORY");
      this.statusText.setColor("#6bf59c");
    } else if (field.gameOver && !field.victory) {
      this.statusText.setText("BASE DESTROYED");
      this.statusText.setColor("#ff5d77");
    } else {
      this.statusText.setText("");
    }

    const selected = this.getSelectedTower(field);
    if (!selected) {
      this.towerInfoText.setText("Select or place a tower to see stats.");
      return;
    }

    const def = TOWER_DEFS[selected.defKey];
    const upgradeCost = Math.floor(def.cost * (0.8 + selected.level * 0.45));
    const sellValue = Math.floor((def.cost + Math.max(0, selected.level - 1) * Math.floor(def.cost * 0.9)) * 0.7);

    this.towerInfoText.setText([
      `${def.name} L${selected.level}`,
      `Damage: ${this.towerDamage(selected).toFixed(1)}`,
      `Range: ${this.towerRange(selected).toFixed(0)}`,
      `Fire/s: ${this.towerFireRate(selected).toFixed(2)}`,
      `Target: ${selected.targetMode}`,
      `Upgrade [U]: ${upgradeCost}g`,
      `Sell [S]: ${sellValue}g`
    ]);

    this.updateSessionButtons();
  }

  private createLossModal(): void {
    const cx = BOARD_X + (GRID_COLS * TILE_SIZE) / 2;
    const cy = BOARD_Y + (GRID_ROWS * TILE_SIZE) / 2;

    const bg = this.add.rectangle(cx, cy, 340, 180, 0x111827, 0.96).setStrokeStyle(2, 0x933447);
    const title = this.add.text(cx, cy - 38, "BASE DESTROYED", {
      fontFamily: "Consolas, monospace",
      fontSize: "28px",
      color: "#ff6f86"
    });
    title.setOrigin(0.5);

    const body = this.add.text(cx, cy, "This session has fallen.", {
      fontFamily: "Consolas, monospace",
      fontSize: "15px",
      color: "#f1d9df"
    });
    body.setOrigin(0.5);

    const okBg = this.add
      .rectangle(cx, cy + 48, 130, 34, 0x2f4f76)
      .setStrokeStyle(1, 0x7ba6e1)
      .setInteractive({ useHandCursor: true });
    const okText = this.add.text(cx, cy + 40, "OK", {
      fontFamily: "Consolas, monospace",
      fontSize: "18px",
      color: "#e8f3ff"
    });
    okText.setOrigin(0.5, 0);

    okBg.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.handleLossConfirm();
    });
    okBg.on("pointerover", () => okBg.setFillStyle(0x3c6090));
    okBg.on("pointerout", () => okBg.setFillStyle(0x2f4f76));

    this.lossModal = this.add.container(0, 0, [bg, title, body, okBg, okText]).setDepth(10).setVisible(false);
  }

  private showLossModal(): void {
    this.lossModalVisible = true;
    this.lossModal.setVisible(true);
  }

  private hideLossModal(): void {
    this.lossModalVisible = false;
    this.lossModal.setVisible(false);
  }

  private updateLossModalVisibility(): void {
    const active = this.getActiveField();
    if (active.gameOver && !active.victory) {
      this.showLossModal();
    } else {
      this.hideLossModal();
    }
  }

  private handleLossConfirm(): void {
    if (!this.lossModalVisible) {
      return;
    }
    this.suppressWorldClickUntil = this.time.now + 150;
    this.restartFieldAtIndex(this.activeFieldIndex);
    this.hideLossModal();
  }

  private restartFieldAtIndex(index: number): void {
    const oldField = this.fields[index];
    for (const tower of oldField.towers) {
      tower.sprite.destroy();
    }
    const nextField = this.createEmptyField(oldField.id);
    nextField.name = oldField.name;
    this.fields[index] = nextField;
    this.refreshTowerVisibility();
    this.updateSessionButtons();
    this.autoSaveTimer = 0;
    this.saveGameState();
  }

  private refreshTowerVisibility(): void {
    for (let i = 0; i < this.fields.length; i += 1) {
      const visible = i === this.activeFieldIndex;
      for (const tower of this.fields[i].towers) {
        tower.sprite.setVisible(visible);
      }
    }
  }

  private saveGameState(): void {
    try {
      const payload: SavedGameState = {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        activeFieldIndex: this.activeFieldIndex,
        fields: this.fields.map((field) => ({
          id: field.id,
          name: field.name,
          nextEnemyId: field.nextEnemyId,
          nextTowerId: field.nextTowerId,
          currentWaveIndex: field.currentWaveIndex,
          spawnedInWave: field.spawnedInWave,
          spawnTimer: field.spawnTimer,
          interWaveTimer: field.interWaveTimer,
          selectedTowerType: field.selectedTowerType,
          selectedTowerId: field.selectedTowerId,
          gold: field.gold,
          baseHp: field.baseHp,
          maxBaseHp: field.maxBaseHp,
          gameSpeed: field.gameSpeed,
          paused: field.paused,
          gameOver: field.gameOver,
          victory: field.victory,
          towers: field.towers.map((tower) => ({
            id: tower.id,
            cellX: tower.cellX,
            cellY: tower.cellY,
            level: tower.level,
            targetMode: tower.targetMode,
            cooldown: tower.cooldown,
            defKey: tower.defKey
          })),
          enemies: field.enemies.map((enemy) => ({
            id: enemy.id,
            type: enemy.type,
            hp: enemy.hp,
            maxHp: enemy.maxHp,
            speed: enemy.speed,
            reward: enemy.reward,
            progress: enemy.progress,
            alive: enemy.alive,
            hitFlash: enemy.hitFlash
          }))
        }))
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors.
    }
  }

  private tryLoadGameState(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw) as SavedGameState;
      if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.fields) || parsed.fields.length === 0) {
        return false;
      }

      this.fields = parsed.fields.map((savedField, idx) => this.deserializeField(savedField, idx));
      while (this.fields.length < SESSION_COUNT) {
        this.fields.push(this.createEmptyField(this.fields.length + 1));
      }
      if (this.fields.length > SESSION_COUNT) {
        for (let i = SESSION_COUNT; i < this.fields.length; i += 1) {
          for (const tower of this.fields[i].towers) {
            tower.sprite.destroy();
          }
        }
        this.fields = this.fields.slice(0, SESSION_COUNT);
      }

      this.activeFieldIndex = Phaser.Math.Clamp(parsed.activeFieldIndex ?? 0, 0, this.fields.length - 1);
      return true;
    } catch {
      return false;
    }
  }

  private deserializeField(saved: SavedFieldState, idx: number): FieldState {
    const field = this.createEmptyField(saved.id || idx + 1);
    field.name = saved.name || `Session ${field.id}`;
    field.nextEnemyId = Math.max(1, saved.nextEnemyId ?? 1);
    field.nextTowerId = Math.max(1, saved.nextTowerId ?? 1);
    field.currentWaveIndex = Phaser.Math.Clamp(saved.currentWaveIndex ?? 0, 0, WAVES.length);
    field.spawnedInWave = Math.max(0, saved.spawnedInWave ?? 0);
    field.spawnTimer = Math.max(0, saved.spawnTimer ?? 0);
    field.interWaveTimer = Math.max(0, saved.interWaveTimer ?? 1.2);
    field.selectedTowerType = saved.selectedTowerType in TOWER_DEFS ? saved.selectedTowerType : "gunner";
    field.selectedTowerId = saved.selectedTowerId ?? null;
    field.gold = Math.max(0, saved.gold ?? 180);
    field.maxBaseHp = Math.max(1, saved.maxBaseHp ?? 20);
    field.baseHp = Phaser.Math.Clamp(saved.baseHp ?? field.maxBaseHp, 0, field.maxBaseHp);
    field.gameSpeed = [1, 2, 4].includes(saved.gameSpeed) ? saved.gameSpeed : 1;
    field.paused = !!saved.paused;
    field.gameOver = !!saved.gameOver;
    field.victory = false;
    if (saved.victory) {
      field.gameOver = false;
    }
    field.shotFx = [];
    field.burstFx = [];
    field.towers = [];
    field.enemies = [];

    const occupied = new Set<string>();
    for (const st of saved.towers || []) {
      if (!(st.defKey in TOWER_DEFS)) {
        continue;
      }
      if (!this.isInsideGrid(st.cellX, st.cellY)) {
        continue;
      }
      const tile = this.tiles[st.cellY][st.cellX];
      if (!tile.buildable || tile.path || tile.blocked) {
        continue;
      }
      const key = `${st.cellX},${st.cellY}`;
      if (occupied.has(key)) {
        continue;
      }
      occupied.add(key);

      const world = this.cellToWorld(st.cellX, st.cellY);
      const sprite = this.createTowerSprite(st.defKey, world.x, world.y, false);
      const level = Math.max(1, st.level);
      sprite.setScale(1 + (level - 1) * 0.04);

      field.towers.push({
        id: st.id,
        cellX: st.cellX,
        cellY: st.cellY,
        x: world.x,
        y: world.y,
        level,
        targetMode: TARGET_MODES.includes(st.targetMode) ? st.targetMode : "first",
        cooldown: Math.max(0, st.cooldown ?? 0),
        defKey: st.defKey,
        sprite
      });
    }

    const totalSegments = this.pathCells.length - 1;
    for (const se of saved.enemies || []) {
      if (!se.alive || !ENEMY_RENDER_STYLES[se.type]) {
        continue;
      }
      const progress = Phaser.Math.Clamp(se.progress, 0, totalSegments);
      const seg = Math.min(totalSegments - 1, Math.floor(progress));
      const t = progress - seg;
      const a = this.pathCells[seg];
      const b = this.pathCells[seg + 1];
      const wx = Phaser.Math.Linear(a.x, b.x, t);
      const wy = Phaser.Math.Linear(a.y, b.y, t);
      const world = this.cellToWorld(wx, wy);

      field.enemies.push({
        id: se.id,
        type: se.type,
        hp: Math.max(1, se.hp),
        maxHp: Math.max(1, se.maxHp),
        speed: Math.max(1, se.speed),
        reward: Math.max(1, se.reward),
        progress,
        alive: true,
        hitFlash: Math.max(0, se.hitFlash ?? 0),
        x: world.x,
        y: world.y
      });
    }

    if (field.selectedTowerId !== null && !field.towers.some((tower) => tower.id === field.selectedTowerId)) {
      field.selectedTowerId = null;
    }

    return field;
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const button = this.add
      .rectangle(x + 100, y + 12, 200, 26, 0x25324a)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x5f7aa2)
      .setInteractive({ useHandCursor: true });

    const text = this.add.text(x, y + 4, label, {
      fontFamily: "Consolas, monospace",
      fontSize: "14px",
      color: "#e4ecff"
    });

    button.on("pointerover", () => button.setFillStyle(0x2f4261));
    button.on("pointerout", () => button.setFillStyle(0x25324a));
    button.on("pointerdown", () => {
      if (!this.lossModalVisible) {
        onClick();
      }
    });

    text.setInteractive({ useHandCursor: true });
    text.on("pointerdown", () => {
      if (!this.lossModalVisible) {
        onClick();
      }
    });
  }

  private isInsideGrid(cellX: number, cellY: number): boolean {
    return cellX >= 0 && cellY >= 0 && cellX < GRID_COLS && cellY < GRID_ROWS;
  }

  private worldToCell(worldX: number, worldY: number): Phaser.Math.Vector2 | null {
    const lx = worldX - BOARD_X;
    const ly = worldY - BOARD_Y;
    if (lx < 0 || ly < 0) {
      return null;
    }
    const x = Math.floor(lx / TILE_SIZE);
    const y = Math.floor(ly / TILE_SIZE);
    if (!this.isInsideGrid(x, y)) {
      return null;
    }
    return new Phaser.Math.Vector2(x, y);
  }

  private cellToWorld(cellX: number, cellY: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(BOARD_X + cellX * TILE_SIZE + TILE_SIZE / 2, BOARD_Y + cellY * TILE_SIZE + TILE_SIZE / 2);
  }

  private getPanelLeft(): number {
    return BOARD_X + GRID_COLS * TILE_SIZE + 18;
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "app",
  backgroundColor: "#111216",
  scene: [GameScene]
});

window.addEventListener("beforeunload", () => {
  game.destroy(true);
});
