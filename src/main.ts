import Phaser from "phaser";
import "./style.css";

type TargetMode = "first" | "last" | "nearest" | "strongest" | "weakest";

interface Tile {
  buildable: boolean;
  blocked: boolean;
  path: boolean;
}

interface Enemy {
  id: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  progress: number;
  alive: boolean;
  sprite: Phaser.GameObjects.Arc;
  hpBar: Phaser.GameObjects.Rectangle;
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

const TILE_SIZE = 56;
const GRID_COLS = 14;
const GRID_ROWS = 8;
const BOARD_X = 20;
const BOARD_Y = 20;
const PANEL_WIDTH = 290;
const GAME_WIDTH = BOARD_X * 2 + GRID_COLS * TILE_SIZE + PANEL_WIDTH;
const GAME_HEIGHT = BOARD_Y * 2 + GRID_ROWS * TILE_SIZE;

const TOWER_DEFS = {
  gunner: { name: "Gunner", color: 0x52c3ff, cost: 50, range: 130, damage: 14, fireRate: 1.2 },
  blaster: { name: "Blaster", color: 0xff9f43, cost: 75, range: 95, damage: 26, fireRate: 0.75 },
  sniper: { name: "Sniper", color: 0xd6f16f, cost: 110, range: 215, damage: 58, fireRate: 0.35 }
} satisfies Record<string, TowerDef>;

const WAVES: WaveDef[] = [
  { count: 12, hp: 55, speed: 84, reward: 8, spawnInterval: 0.72 },
  { count: 18, hp: 90, speed: 95, reward: 10, spawnInterval: 0.58 },
  { count: 22, hp: 125, speed: 108, reward: 12, spawnInterval: 0.52 }
];

const TARGET_MODES: TargetMode[] = ["first", "last", "nearest", "strongest", "weakest"];

class GameScene extends Phaser.Scene {
  private tiles: Tile[][] = [];
  private tileVisuals: Phaser.GameObjects.Rectangle[][] = [];
  private pathCells: Phaser.Math.Vector2[] = [];

  private towers: Tower[] = [];
  private enemies: Enemy[] = [];

  private nextEnemyId = 1;
  private nextTowerId = 1;

  private currentWaveIndex = 0;
  private spawnedInWave = 0;
  private spawnTimer = 0;
  private interWaveTimer = 1.6;

  private selectedTowerType: keyof typeof TOWER_DEFS = "gunner";
  private selectedTowerId: number | null = null;
  private hoverCell: Phaser.Math.Vector2 | null = null;

  private gold = 180;
  private baseHp = 20;
  private maxBaseHp = 20;

  private gameSpeed = 1;
  private paused = false;
  private gameOver = false;
  private victory = false;

  private hudText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private towerInfoText!: Phaser.GameObjects.Text;
  private hoverPreview!: Phaser.GameObjects.Rectangle;
  private rangeCircle!: Phaser.GameObjects.Arc;

  constructor() {
    super("game");
  }

  create(): void {
    this.createMap();
    this.drawBoard();
    this.createHud();
    this.createInput();
  }

  update(_: number, deltaMs: number): void {
    const delta = (deltaMs / 1000) * this.gameSpeed;

    this.updateHoverPreview();

    if (this.paused || this.gameOver) {
      this.syncUi();
      return;
    }

    this.runWave(delta);
    this.updateEnemies(delta);
    this.updateTowers(delta);
    this.cleanupEnemies();
    this.checkEndState();

    this.syncUi();
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

    this.tileVisuals = [];
    for (let y = 0; y < GRID_ROWS; y += 1) {
      const row: Phaser.GameObjects.Rectangle[] = [];
      for (let x = 0; x < GRID_COLS; x += 1) {
        const world = this.cellToWorld(x, y);
        const tile = this.tiles[y][x];
        const color = tile.path ? 0x37465f : tile.blocked ? 0x2b2c34 : 0x1f3f2f;
        const rect = this.add
          .rectangle(world.x, world.y, TILE_SIZE - 2, TILE_SIZE - 2, color)
          .setStrokeStyle(1, 0x0d0f14, 0.9);
        row.push(rect);
      }
      this.tileVisuals.push(row);
    }

    this.add
      .rectangle(this.getPanelLeft() + PANEL_WIDTH / 2, GAME_HEIGHT / 2, PANEL_WIDTH - 14, GAME_HEIGHT - 10, 0x161922)
      .setStrokeStyle(1, 0x2e3447);

    this.hoverPreview = this.add.rectangle(-100, -100, TILE_SIZE - 8, TILE_SIZE - 8, 0x4ae291, 0.35);
    this.rangeCircle = this.add.circle(-100, -100, 10, 0x7fd6ff, 0.12).setStrokeStyle(2, 0x7fd6ff, 0.7);
  }

  private createHud(): void {
    this.hudText = this.add.text(this.getPanelLeft() + 20, 24, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "16px",
      color: "#dbe2ff",
      lineSpacing: 6
    });

    this.statusText = this.add.text(this.getPanelLeft() + 20, GAME_HEIGHT - 64, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "18px",
      color: "#ffd369"
    });

    this.towerInfoText = this.add.text(this.getPanelLeft() + 20, 250, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "14px",
      color: "#bfd5ff",
      wordWrap: { width: PANEL_WIDTH - 40 }
    });

    this.makeButton(this.getPanelLeft() + 20, 132, "1 Gunner", () => {
      this.selectedTowerType = "gunner";
      this.selectedTowerId = null;
    });

    this.makeButton(this.getPanelLeft() + 20, 167, "2 Blaster", () => {
      this.selectedTowerType = "blaster";
      this.selectedTowerId = null;
    });

    this.makeButton(this.getPanelLeft() + 20, 202, "3 Sniper", () => {
      this.selectedTowerType = "sniper";
      this.selectedTowerId = null;
    });

    this.makeButton(this.getPanelLeft() + 20, 360, "Speed 1x", () => {
      this.gameSpeed = 1;
    });

    this.makeButton(this.getPanelLeft() + 20, 395, "Speed 2x", () => {
      this.gameSpeed = 2;
    });

    this.makeButton(this.getPanelLeft() + 20, 430, "Speed 4x", () => {
      this.gameSpeed = 4;
    });

    this.makeButton(this.getPanelLeft() + 20, 470, "Pause", () => {
      this.paused = !this.paused;
    });

    this.makeButton(this.getPanelLeft() + 20, 505, "Restart", () => {
      this.resetRun();
    });

    this.syncUi();
  }

  private createInput(): void {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const cell = this.worldToCell(pointer.worldX, pointer.worldY);
      this.hoverCell = cell;
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const cell = this.worldToCell(pointer.worldX, pointer.worldY);
      if (!cell || this.gameOver || this.paused) {
        return;
      }

      if (pointer.rightButtonDown()) {
        this.trySelectTower(cell.x, cell.y);
        return;
      }

      const pickedTower = this.findTower(cell.x, cell.y);
      if (pickedTower) {
        this.selectedTowerId = pickedTower.id;
      } else {
        this.tryPlaceTower(cell.x, cell.y);
      }
    });

    this.input.keyboard?.on("keydown-ONE", () => {
      this.selectedTowerType = "gunner";
      this.selectedTowerId = null;
    });
    this.input.keyboard?.on("keydown-TWO", () => {
      this.selectedTowerType = "blaster";
      this.selectedTowerId = null;
    });
    this.input.keyboard?.on("keydown-THREE", () => {
      this.selectedTowerType = "sniper";
      this.selectedTowerId = null;
    });

    this.input.keyboard?.on("keydown-U", () => this.tryUpgradeSelected());
    this.input.keyboard?.on("keydown-S", () => this.trySellSelected());
    this.input.keyboard?.on("keydown-T", () => this.cycleSelectedTargetMode());

    this.input.keyboard?.on("keydown-SPACE", () => {
      this.paused = !this.paused;
    });

    this.input.keyboard?.on("keydown-Q", () => {
      this.gameSpeed = 1;
    });
    this.input.keyboard?.on("keydown-W", () => {
      this.gameSpeed = 2;
    });
    this.input.keyboard?.on("keydown-E", () => {
      this.gameSpeed = 4;
    });

    this.input.keyboard?.on("keydown-R", () => {
      this.resetRun();
    });
  }

  private runWave(delta: number): void {
    if (this.currentWaveIndex >= WAVES.length) {
      return;
    }

    const wave = WAVES[this.currentWaveIndex];

    if (this.spawnedInWave < wave.count) {
      this.spawnTimer += delta;
      while (this.spawnTimer >= wave.spawnInterval && this.spawnedInWave < wave.count) {
        this.spawnTimer -= wave.spawnInterval;
        this.spawnEnemy(wave);
        this.spawnedInWave += 1;
      }
      return;
    }

    if (this.enemies.length === 0) {
      this.interWaveTimer -= delta;
      if (this.interWaveTimer <= 0) {
        this.currentWaveIndex += 1;
        this.spawnedInWave = 0;
        this.spawnTimer = 0;
        this.interWaveTimer = 2;
      }
    }
  }

  private spawnEnemy(wave: WaveDef): void {
    const spawnWorld = this.cellToWorld(this.pathCells[0].x, this.pathCells[0].y);
    const sprite = this.add.circle(spawnWorld.x, spawnWorld.y, 11, 0xcb5d74);
    const hpBar = this.add.rectangle(spawnWorld.x, spawnWorld.y - 16, 20, 3, 0x5af26d);

    this.enemies.push({
      id: this.nextEnemyId++,
      hp: wave.hp,
      maxHp: wave.hp,
      speed: wave.speed,
      reward: wave.reward,
      progress: 0,
      alive: true,
      sprite,
      hpBar
    });
  }

  private updateEnemies(delta: number): void {
    const totalSegments = this.pathCells.length - 1;
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      enemy.progress += (enemy.speed * delta) / TILE_SIZE;

      if (enemy.progress >= totalSegments) {
        enemy.alive = false;
        this.baseHp -= 1;
        continue;
      }

      const seg = Math.floor(enemy.progress);
      const t = enemy.progress - seg;
      const a = this.pathCells[seg];
      const b = this.pathCells[seg + 1];

      const x = Phaser.Math.Linear(a.x, b.x, t);
      const y = Phaser.Math.Linear(a.y, b.y, t);
      const world = this.cellToWorld(x, y);

      enemy.sprite.setPosition(world.x, world.y);

      const hpRatio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
      enemy.hpBar.setPosition(world.x, world.y - 16);
      enemy.hpBar.width = 20 * hpRatio;
      enemy.hpBar.setFillStyle(hpRatio > 0.4 ? 0x5af26d : 0xff6b6b);
    }
  }

  private updateTowers(delta: number): void {
    for (const tower of this.towers) {
      const def = TOWER_DEFS[tower.defKey];
      tower.cooldown -= delta;
      if (tower.cooldown > 0) {
        continue;
      }

      const range = this.towerRange(tower);
      const target = this.pickTarget(tower, range);
      if (!target) {
        continue;
      }

      const damage = this.towerDamage(tower);
      target.hp -= damage;

      const tracer = this.add
        .line(0, 0, tower.x, tower.y, target.sprite.x, target.sprite.y, 0xfff2a6, 0.8)
        .setLineWidth(2, 2)
        .setDepth(3)
        .setAlpha(0.85);
      this.time.delayedCall(60, () => tracer.destroy());

      tower.cooldown = 1 / this.towerFireRate(tower);

      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        this.gold += target.reward;
      }
    }
  }

  private cleanupEnemies(): void {
    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.alive) {
        return true;
      }
      enemy.sprite.destroy();
      enemy.hpBar.destroy();
      return false;
    });
  }

  private checkEndState(): void {
    if (this.baseHp <= 0) {
      this.baseHp = 0;
      this.gameOver = true;
      this.victory = false;
      return;
    }

    if (this.currentWaveIndex >= WAVES.length && this.enemies.length === 0) {
      this.gameOver = true;
      this.victory = true;
    }
  }

  private tryPlaceTower(cellX: number, cellY: number): void {
    if (!this.isInsideGrid(cellX, cellY)) {
      return;
    }

    const tile = this.tiles[cellY][cellX];
    if (!tile.buildable || tile.blocked || tile.path) {
      return;
    }

    if (this.findTower(cellX, cellY)) {
      return;
    }

    const def = TOWER_DEFS[this.selectedTowerType];
    if (this.gold < def.cost) {
      return;
    }

    this.gold -= def.cost;

    const world = this.cellToWorld(cellX, cellY);
    const sprite = this.add.rectangle(world.x, world.y, TILE_SIZE - 10, TILE_SIZE - 10, def.color).setStrokeStyle(2, 0x0f1218);

    const tower: Tower = {
      id: this.nextTowerId++,
      cellX,
      cellY,
      x: world.x,
      y: world.y,
      level: 1,
      targetMode: "first",
      cooldown: Phaser.Math.FloatBetween(0.05, 0.22),
      defKey: this.selectedTowerType,
      sprite
    };

    this.towers.push(tower);
    this.selectedTowerId = tower.id;
  }

  private trySelectTower(cellX: number, cellY: number): void {
    const tower = this.findTower(cellX, cellY);
    this.selectedTowerId = tower ? tower.id : null;
  }

  private tryUpgradeSelected(): void {
    const tower = this.getSelectedTower();
    if (!tower) {
      return;
    }

    const baseCost = TOWER_DEFS[tower.defKey].cost;
    const upgradeCost = Math.floor(baseCost * (0.8 + tower.level * 0.45));
    if (this.gold < upgradeCost) {
      return;
    }

    this.gold -= upgradeCost;
    tower.level += 1;
    tower.sprite.setScale(1 + (tower.level - 1) * 0.04);
  }

  private trySellSelected(): void {
    const tower = this.getSelectedTower();
    if (!tower) {
      return;
    }

    const baseCost = TOWER_DEFS[tower.defKey].cost;
    const upgradeSpend = Math.max(0, tower.level - 1) * Math.floor(baseCost * 0.9);
    const totalSpend = baseCost + upgradeSpend;
    const refund = Math.floor(totalSpend * 0.7);

    this.gold += refund;
    tower.sprite.destroy();
    this.towers = this.towers.filter((t) => t.id !== tower.id);
    this.selectedTowerId = null;
  }

  private cycleSelectedTargetMode(): void {
    const tower = this.getSelectedTower();
    if (!tower) {
      return;
    }

    const index = TARGET_MODES.indexOf(tower.targetMode);
    tower.targetMode = TARGET_MODES[(index + 1) % TARGET_MODES.length];
  }

  private pickTarget(tower: Tower, range: number): Enemy | null {
    const candidates = this.enemies.filter((enemy) => {
      if (!enemy.alive) {
        return false;
      }
      const dist = Phaser.Math.Distance.Between(tower.x, tower.y, enemy.sprite.x, enemy.sprite.y);
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
          const da = Phaser.Math.Distance.Between(tower.x, tower.y, a.sprite.x, a.sprite.y);
          const db = Phaser.Math.Distance.Between(tower.x, tower.y, b.sprite.x, b.sprite.y);
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
    return def.fireRate * (1 + (tower.level - 1) * 0.08);
  }

  private findTower(cellX: number, cellY: number): Tower | undefined {
    return this.towers.find((tower) => tower.cellX === cellX && tower.cellY === cellY);
  }

  private getSelectedTower(): Tower | undefined {
    if (this.selectedTowerId === null) {
      return undefined;
    }
    return this.towers.find((tower) => tower.id === this.selectedTowerId);
  }

  private updateHoverPreview(): void {
    if (!this.hoverCell || !this.isInsideGrid(this.hoverCell.x, this.hoverCell.y) || this.gameOver) {
      this.hoverPreview.setPosition(-100, -100);
      return;
    }

    const towerAtCell = this.findTower(this.hoverCell.x, this.hoverCell.y);
    const tile = this.tiles[this.hoverCell.y][this.hoverCell.x];

    const placeAllowed = tile.buildable && !towerAtCell && this.gold >= TOWER_DEFS[this.selectedTowerType].cost;
    const world = this.cellToWorld(this.hoverCell.x, this.hoverCell.y);
    this.hoverPreview.setPosition(world.x, world.y);
    this.hoverPreview.setFillStyle(placeAllowed ? 0x4ae291 : 0xff5d77, 0.35);

    const selected = this.getSelectedTower();
    if (selected) {
      this.rangeCircle.setPosition(selected.x, selected.y);
      this.rangeCircle.radius = this.towerRange(selected);
      selected.sprite.setStrokeStyle(3, 0xf6fb86);
    } else {
      this.rangeCircle.setPosition(-100, -100);
    }

    for (const tower of this.towers) {
      if (!selected || tower.id !== selected.id) {
        tower.sprite.setStrokeStyle(2, 0x0f1218);
      }
    }
  }

  private syncUi(): void {
    const waveLabel = this.currentWaveIndex >= WAVES.length ? `${WAVES.length}/${WAVES.length}` : `${this.currentWaveIndex + 1}/${WAVES.length}`;
    const selectedDef = TOWER_DEFS[this.selectedTowerType];

    this.hudText.setText([
      `Gold: ${this.gold}`,
      `Base HP: ${this.baseHp}/${this.maxBaseHp}`,
      `Wave: ${waveLabel}`,
      `Enemies: ${this.enemies.length}`,
      `Speed: ${this.gameSpeed}x ${this.paused ? "(Paused)" : ""}`,
      "",
      `Selected build: ${selectedDef.name} (${selectedDef.cost}g)`,
      "Hotkeys: 1/2/3 build, U upgrade, S sell",
      "T target mode, Q/W/E speed, Space pause, R restart",
      "Right-click tile to select tower"
    ]);

    if (this.gameOver) {
      this.statusText.setText(this.victory ? "VICTORY" : "DEFEAT");
      this.statusText.setColor(this.victory ? "#6bf59c" : "#ff5d77");
    } else {
      this.statusText.setText("");
    }

    const selected = this.getSelectedTower();
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
  }

  private resetRun(): void {
    for (const tower of this.towers) {
      tower.sprite.destroy();
    }
    for (const enemy of this.enemies) {
      enemy.sprite.destroy();
      enemy.hpBar.destroy();
    }

    this.towers = [];
    this.enemies = [];

    this.nextEnemyId = 1;
    this.nextTowerId = 1;

    this.currentWaveIndex = 0;
    this.spawnedInWave = 0;
    this.spawnTimer = 0;
    this.interWaveTimer = 1.2;

    this.selectedTowerType = "gunner";
    this.selectedTowerId = null;

    this.gold = 180;
    this.baseHp = this.maxBaseHp;

    this.gameSpeed = 1;
    this.paused = false;
    this.gameOver = false;
    this.victory = false;

    this.statusText.setText("");
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
    button.on("pointerdown", onClick);

    text.setInteractive({ useHandCursor: true });
    text.on("pointerdown", onClick);
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
