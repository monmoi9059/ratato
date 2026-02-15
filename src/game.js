// Constants and Initialization
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- NEW WORLD/CAMERA CONSTANTS ---
let VIEWPORT_RADIUS = 350; // Radius of the visible area (Updated dynamically)
const WORLD_RADIUS = 1500;   // Radius of the entire explorable world
const WORLD_CENTER_X = 0;
const WORLD_CENTER_Y = 0;
// The center of the visible canvas (where the Rat is drawn)
let centerX = canvas.width / 2;
let centerY = canvas.height / 2;

const ARENA_RADIUS = VIEWPORT_RADIUS; // Alias for old code compatibility
// --- END NEW CONSTANTS ---

// Function to handle canvas resizing
function resizeCanvas() {
    // Set internal resolution to full window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Update global center coordinates
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;

    // Update Viewport Radius to ensure it covers the screen corners plus margin
    VIEWPORT_RADIUS = Math.hypot(centerX, centerY) + 50;
}

// Initial resize and event listener
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- VIRTUAL JOYSTICK LOGIC ---
const joystickState = { active: false, x: 0, y: 0 };

function initJoystick() {
    const zone = document.getElementById('joystickZone');
    const knob = document.getElementById('joystickKnob');
    if (!zone || !knob) return;

    // Show joystick if touch is supported
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        zone.classList.remove('hidden');
    }

    const maxRadius = zone.offsetWidth / 2;

    const handleTouch = (e) => {
        e.preventDefault(); // Prevent scrolling
        const touch = e.targetTouches[0];
        if (!touch) return;

        const rect = zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = touch.clientX - cx;
        const dy = touch.clientY - cy;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        const cappedDist = Math.min(distance, maxRadius);

        // Visual update
        const knobX = Math.cos(angle) * cappedDist;
        const knobY = Math.sin(angle) * cappedDist;
        knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

        // Logic update
        if (distance > 5) {
            joystickState.active = true;
            joystickState.x = Math.cos(angle);
            joystickState.y = Math.sin(angle);
        } else {
            joystickState.active = false;
            joystickState.x = 0;
            joystickState.y = 0;
        }
    };

    const resetJoystick = (e) => {
        if (e) e.preventDefault();
        joystickState.active = false;
        joystickState.x = 0;
        joystickState.y = 0;
        knob.style.transform = `translate(-50%, -50%)`;
    };

    zone.addEventListener('touchstart', (e) => {
         resetJoystick(); // Ensure clean start
         handleTouch(e);
    }, { passive: false });

    zone.addEventListener('touchmove', handleTouch, { passive: false });
    zone.addEventListener('touchend', resetJoystick);
    zone.addEventListener('touchcancel', resetJoystick);
}

// Initialize Joystick
initJoystick();
// --- END JOYSTICK LOGIC ---

const BASE_PROJECTILE_RANGE = 173; // Was 230, reduced by 25%

const HIGHSCORE_KEY = 'ratato_best_kills'; // Key for localStorage

let game;
let animationFrameId;

let highScore = parseInt(localStorage.getItem(HIGHSCORE_KEY) || '0', 10); // Load high score

// --- DYNAMIC COLOR PALETTES (Swaps every 10 waves) ---
const COLOR_PALETTES = {
    // Standard Dirt Arena (Wave 1-9, 41-49, etc.)
    dirt: {
        name: "Dirt Arena",
        arenaBase: '#3b4455', // Gray-blue dirt
        arenaPebbles: '#718096',
        arenaBorder: '#fbd38d',
        defaultSnake: '#48bb78', // Green
        fastSnake: '#f6ad55',    // Orange
        tankSnake: '#744210',    // Brown
        detonatorSnake: '#ffc700', // Bright Yellow
        rangedSnake: '#b794f4', // Purple
        boss: '#3182ce',         // Blue Boss
    },
    // Toxic Swamp (Wave 11-19, 51-59, etc.)
    toxic: {
        name: "Toxic Swamp",
        arenaBase: '#3d4852', // Dark muddy base
        arenaPebbles: '#2c3748',
        arenaBorder: '#9ae6b4', // Bright green glow
        defaultSnake: '#409c13', // Deep Toxic Green
        fastSnake: '#b9a5c8',    // Purple/Violet fast
        tankSnake: '#581c87',    // Deep Purple tank
        detonatorSnake: '#ff4d4d', // Bright Red
        rangedSnake: '#f56565', // Red
        boss: '#7f3697',         // Neon Purple Boss
    },
    // Desert (Wave 21-29, 61-69, etc.)
    desert: {
        name: "Desert Sands",
        arenaBase: '#c3954d', // Sandy color
        arenaPebbles: '#a07d3f',
        arenaBorder: '#e53e3e', // Red border
        defaultSnake: '#8b4513', // Tan/Brown snakes
        fastSnake: '#e53e3e',    // Red fast
        tankSnake: '#4a0e0e',    // Dark red/black tank
        detonatorSnake: '#f59e0b', // Desert Gold
        rangedSnake: '#9f7aea', // Purple
        boss: '#f6ad55',         // Gold/Orange Boss
    },
    // Ice Cave (Wave 31-39, 71-79, etc.)
    ice: {
        name: "Ice Cave",
        arenaBase: '#58737e', // Pale blue/gray ice base
        arenaPebbles: '#80afc0',
        arenaBorder: '#4299e1', // Bright blue glow
        defaultSnake: '#a0aec0', // Pale grey/white snakes
        fastSnake: '#ff4d4d',    // Red fast (frozen)
        tankSnake: '#3182ce',    // Dark blue tank
        detonatorSnake: '#ff4d4d', // Bright Red
        rangedSnake: '#ed64a6', // Pink
        boss: '#00ccff',         // Cyan Boss
    }
};
let currentPalette = COLOR_PALETTES.dirt;


// --- CHARACTER DEFINITIONS (Custom Colors/Skins & Uniform Inventory Limits) ---
const UNIFORM_MAX_SLOTS = 8; // Max slots is 8 for all classes on start

// Define affinity constants
const MELEE_AFFINITY_RANGE = 3.0; // +200% base melee radius
const RANGED_AFFINITY_RANGE = 2.0; // +100% base ranged range
const SPREAD_AFFINITY_PROJ = 3;   // +3 base projectiles

const CHARACTERS = {
    // 1. The Melee/Tank
    brawler: {
        name: "The Brawler",
        description: "Focus: Tank/Melee. High HP and Armor with massive melee reach.",
        initialStats: {
            maxHp: 500, baseSpeed: 3.5, damageMultiplier: 1.0, armor: 4, evasion: 0.0,
            projectileCountBonus: 0, fireRateReduction: 1.0, attackRangeMultiplier: 0.9, shield: 10, bounceCount: 0,
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: MELEE_AFFINITY_RANGE // NEW AFFINITY
        },
        ratColors: { main: '#713e2f', light: '#a0522d', detail: '#4a2500' },
        starterWeapon: 'tailWhip'
    },
    // 2. The Heavy Ranged
    sharpshooter: {
        name: "The Sharpshooter",
        description: "Focus: Pure Damage/Range. Extreme damage and range for true sniping.",
        initialStats: {
            maxHp: 160, baseSpeed: 4.0, damageMultiplier: 1.8, armor: 0, evasion: 0.05,
            projectileCountBonus: 0, fireRateReduction: 0.9, attackRangeMultiplier: RANGED_AFFINITY_RANGE, shield: 0, bounceCount: 0,
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: 1.0
        },
        ratColors: { main: '#3182ce', light: '#63b3ed', detail: '#2b6cb0' },
        starterWeapon: 'dagger'
    },
    // 3. The Evasion/Speedster
    fleetfoot: {
        name: "The Fleetfoot",
        description: "Focus: Speed/Bounce. Max speed and evasion, plus starting bounce utility.",
        initialStats: {
            maxHp: 180, baseSpeed: 7.0, damageMultiplier: 0.9, armor: 0, evasion: 0.25,
            projectileCountBonus: 0, fireRateReduction: 1.1, attackRangeMultiplier: 1.0, shield: 0, bounceCount: 2, // Boosted starting bounce
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: 1.0
        },
        ratColors: { main: '#f6ad55', light: '#ffc785', detail: '#dd6b20' },
        starterWeapon: 'dagger'
    },
    // 4. The Fast Melee
    swordsman: {
        name: "The Swordsman",
        description: "Focus: Melee Speed/Range. Hyper fast attack rate and massive melee reach.",
        initialStats: {
            maxHp: 320, baseSpeed: 5.0, damageMultiplier: 1.1, armor: 1, evasion: 0.10,
            projectileCountBonus: 2, fireRateReduction: 1.3, attackRangeMultiplier: 1.0, shield: 5, bounceCount: 0,
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: MELEE_AFFINITY_RANGE // NEW AFFINITY
        },
        ratColors: { main: '#b0b0b0', light: '#c0c0c0', detail: '#737373' },
        starterWeapon: 'tailWhip'
    },
    // 5. The Projectile Volley
    shogun: {
        name: "The Shogun",
        description: "Focus: Spread/Projectiles. Massive starting volley count and high defense.",
        initialStats: {
            maxHp: 280, baseSpeed: 4.3, damageMultiplier: 1.1, armor: 2, evasion: 0.0,
            projectileCountBonus: SPREAD_AFFINITY_PROJ, fireRateReduction: 1.0, attackRangeMultiplier: 1.0, shield: 0, bounceCount: 0,
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: 1.0
        },
        ratColors: { main: '#713e2f', light: '#a0522d', detail: '#dd6b20' },
        starterWeapon: 'magicCheese'
    },
    // 6. The Long Range Sniper
    marksman: {
        name: "The Marksman",
        description: "Focus: Range/Precision. Unmatched projectile travel distance and high damage.",
        initialStats: {
            maxHp: 200, baseSpeed: 4.3, damageMultiplier: 1.3, armor: 0, evasion: 0.05,
            projectileCountBonus: 0, fireRateReduction: 0.9, attackRangeMultiplier: RANGED_AFFINITY_RANGE, shield: 0, bounceCount: 0,
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: 1.0
        },
        ratColors: { main: '#a0aec0', light: '#b0c4de', detail: '#63b3ed' },
        starterWeapon: 'dagger'
    },
    // 7. The Sustain DPS
    minigunner: {
        name: "The Minigunner",
        description: "Focus: Fire Rate/Range. Top attack speed and solid range for sustained DPS.",
        initialStats: {
            maxHp: 240, baseSpeed: 4.7, damageMultiplier: 1.0, armor: 0, evasion: 0.0,
            projectileCountBonus: 2, fireRateReduction: 1.7, attackRangeMultiplier: RANGED_AFFINITY_RANGE, shield: 0, bounceCount: 0,
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: 1.0
        },
        ratColors: { main: '#5c646c', light: '#80878e', detail: '#3b4455' },
        starterWeapon: 'magicCheese'
    },
    // 8. The AoE Specialist
    pyro: {
        name: "The Pyro",
        description: "Focus: Fire Rate/AoE. High attack speed and evasion for close-range clearing.",
        initialStats: {
            maxHp: 260, baseSpeed: 4.5, damageMultiplier: 1.1, armor: 0, evasion: 0.20,
            projectileCountBonus: 2, fireRateReduction: 1.5, // Boosted fire rate and projectiles
            attackRangeMultiplier: 0.7, shield: 0, bounceCount: 0,
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: 1.0
        },
        ratColors: { main: '#e53e3e', light: '#f6ad55', detail: '#ff4500' },
        starterWeapon: 'molotov'
    },
    // 9. The Explosives Expert
    rocketRat: {
        name: "The Rocket Rat",
        description: "Focus: Explosives/HP. Highest damage multiplier and high HP for heavy ordnance.",
        initialStats: {
            maxHp: 400, baseSpeed: 3.5, damageMultiplier: 2.0, armor: 1, evasion: 0.0,
            projectileCountBonus: 0, fireRateReduction: 0.8, attackRangeMultiplier: 1.0, shield: 15, bounceCount: 0,
            lifestealPercentage: 0.0, currency: 0, maxWeapons: 6,
            meleeRangeMultiplier: 1.0
        },
        ratColors: { main: '#6b46c1', light: '#9f7aea', detail: '#44337a' },
        starterWeapon: 'axe'
    }
};


// --- WEAPON DEFINITIONS ---
const WEAPONS = {
    // 1. MAGIC WAND (Nearest)
    magicCheese: {
        key: 'magicCheese', name: "Magic Cheese", emoji: "🧀",
        description: "Fires a projectile at the nearest enemy.",
        type: 'projectile-nearest',
        requiredPassive: 'emptyTome', evolvesTo: 'minigunCheese',
        iconColor: '#f6ad55',
        levels: [
            { damage: 10, amount: 1, cooldown: 1000, area: 1, speed: 10, duration: 0, knockback: 2, pierce: 0 },
            { damage: 10, amount: 2, cooldown: 1000, area: 1, speed: 10, duration: 0, knockback: 2, pierce: 0 },
            { damage: 10, amount: 2, cooldown: 900,  area: 1, speed: 10, duration: 0, knockback: 2, pierce: 0 },
            { damage: 15, amount: 3, cooldown: 900,  area: 1, speed: 10, duration: 0, knockback: 2, pierce: 0 },
            { damage: 15, amount: 3, cooldown: 900,  area: 1, speed: 10, duration: 0, knockback: 2, pierce: 1 },
            { damage: 15, amount: 3, cooldown: 800,  area: 1, speed: 10, duration: 0, knockback: 2, pierce: 1 },
            { damage: 20, amount: 4, cooldown: 800,  area: 1, speed: 10, duration: 0, knockback: 2, pierce: 1 },
            { damage: 20, amount: 4, cooldown: 800,  area: 1, speed: 10, duration: 0, knockback: 2, pierce: 2 }
        ]
    },
    // 2. KNIFE (Facing)
    dagger: {
        key: 'dagger', name: "Dagger", emoji: "🗡️",
        description: "Fires quickly in the direction you are facing.",
        type: 'projectile-facing',
        requiredPassive: 'bracer', evolvesTo: 'thousandDaggers',
        iconColor: '#718096',
        levels: [
            { damage: 6, amount: 1, cooldown: 300, area: 1, speed: 15, duration: 0, knockback: 1, pierce: 0 },
            { damage: 6, amount: 2, cooldown: 300, area: 1, speed: 15, duration: 0, knockback: 1, pierce: 0 },
            { damage: 6, amount: 3, cooldown: 300, area: 1, speed: 15, duration: 0, knockback: 1, pierce: 0 },
            { damage: 9, amount: 3, cooldown: 300, area: 1, speed: 15, duration: 0, knockback: 1, pierce: 0 },
            { damage: 9, amount: 4, cooldown: 300, area: 1, speed: 15, duration: 0, knockback: 1, pierce: 1 },
            { damage: 9, amount: 4, cooldown: 300, area: 1, speed: 15, duration: 0, knockback: 1, pierce: 1 },
            { damage: 12, amount: 5, cooldown: 300, area: 1, speed: 15, duration: 0, knockback: 1, pierce: 1 },
            { damage: 12, amount: 5, cooldown: 300, area: 1, speed: 15, duration: 0, knockback: 1, pierce: 2 }
        ]
    },
    // 3. AXE (Upward Arc)
    axe: {
        key: 'axe', name: "Axe", emoji: "🪓",
        description: "Throws an axe in a high arc.",
        type: 'projectile-upward',
        requiredPassive: 'candelabrador', evolvesTo: 'deathSpiral',
        iconColor: '#713e2f',
        levels: [
            { damage: 20, amount: 1, cooldown: 1500, area: 1.5, speed: 8, duration: 0, knockback: 5, pierce: 99 },
            { damage: 20, amount: 2, cooldown: 1500, area: 1.5, speed: 8, duration: 0, knockback: 5, pierce: 99 },
            { damage: 30, amount: 2, cooldown: 1500, area: 1.5, speed: 8, duration: 0, knockback: 5, pierce: 99 },
            { damage: 30, amount: 2, cooldown: 1500, area: 1.7, speed: 8, duration: 0, knockback: 5, pierce: 99 },
            { damage: 40, amount: 3, cooldown: 1500, area: 1.7, speed: 8, duration: 0, knockback: 5, pierce: 99 },
            { damage: 40, amount: 3, cooldown: 1500, area: 1.7, speed: 8, duration: 0, knockback: 5, pierce: 99 },
            { damage: 50, amount: 3, cooldown: 1300, area: 1.9, speed: 8, duration: 0, knockback: 5, pierce: 99 },
            { damage: 50, amount: 4, cooldown: 1300, area: 1.9, speed: 8, duration: 0, knockback: 5, pierce: 99 }
        ]
    },
    // 4. WHIP (Horizontal)
    tailWhip: {
        key: 'tailWhip', name: "Tail Whip", emoji: "🐁",
        description: "Strikes horizontally, passing through enemies.",
        type: 'directional-melee',
        requiredPassive: 'emptyHeart', evolvesTo: 'bloodyTail',
        iconColor: '#b794f4',
        levels: [
            { damage: 10, amount: 1, cooldown: 1350, area: 1.0, speed: 0, duration: 200, knockback: 3, pierce: 99 },
            { damage: 10, amount: 1, cooldown: 1350, area: 1.0, speed: 0, duration: 200, knockback: 3, pierce: 99 },
            { damage: 15, amount: 1, cooldown: 1350, area: 1.0, speed: 0, duration: 200, knockback: 3, pierce: 99 },
            { damage: 15, amount: 1, cooldown: 1350, area: 1.1, speed: 0, duration: 200, knockback: 3, pierce: 99 },
            { damage: 20, amount: 1, cooldown: 1350, area: 1.1, speed: 0, duration: 200, knockback: 3, pierce: 99 },
            { damage: 20, amount: 1, cooldown: 1350, area: 1.2, speed: 0, duration: 200, knockback: 3, pierce: 99 },
            { damage: 25, amount: 1, cooldown: 1350, area: 1.2, speed: 0, duration: 200, knockback: 3, pierce: 99 },
            { damage: 30, amount: 1, cooldown: 1350, area: 1.3, speed: 0, duration: 200, knockback: 3, pierce: 99 }
        ]
    },
    // 5. GARLIC (Aura)
    stinkyCheese: {
        key: 'stinkyCheese', name: "Stinky Cheese", emoji: "🤢",
        description: "Damages nearby enemies. Reduces resistance to knockback.",
        type: 'aura',
        requiredPassive: 'pummarola', evolvesTo: 'toxicCloud',
        iconColor: '#9ae6b4',
        levels: [
            { damage: 3, amount: 1, cooldown: 200, area: 1.0, speed: 0, duration: 0, knockback: 1, pierce: 99 },
            { damage: 3, amount: 1, cooldown: 200, area: 1.2, speed: 0, duration: 0, knockback: 1, pierce: 99 },
            { damage: 4, amount: 1, cooldown: 200, area: 1.2, speed: 0, duration: 0, knockback: 1, pierce: 99 },
            { damage: 4, amount: 1, cooldown: 200, area: 1.4, speed: 0, duration: 0, knockback: 1, pierce: 99 },
            { damage: 5, amount: 1, cooldown: 200, area: 1.4, speed: 0, duration: 0, knockback: 1, pierce: 99 },
            { damage: 5, amount: 1, cooldown: 200, area: 1.6, speed: 0, duration: 0, knockback: 1, pierce: 99 },
            { damage: 6, amount: 1, cooldown: 200, area: 1.6, speed: 0, duration: 0, knockback: 1, pierce: 99 },
            { damage: 7, amount: 1, cooldown: 200, area: 1.8, speed: 0, duration: 0, knockback: 1, pierce: 99 }
        ]
    },
    // 6. KING BIBLE (Orbit)
    orbitingShield: {
        key: 'orbitingShield', name: "Orbiting Shield", emoji: "🛡️",
        description: "Orbits around the player.",
        type: 'orbit',
        requiredPassive: 'spellbinder', evolvesTo: 'thunderShield',
        iconColor: '#63b3ed',
        levels: [
            { damage: 10, amount: 1, cooldown: 3000, area: 1.0, speed: 5, duration: 3000, knockback: 2, pierce: 99 },
            { damage: 10, amount: 2, cooldown: 3000, area: 1.0, speed: 5, duration: 3000, knockback: 2, pierce: 99 },
            { damage: 10, amount: 2, cooldown: 3000, area: 1.0, speed: 6, duration: 3000, knockback: 2, pierce: 99 },
            { damage: 15, amount: 3, cooldown: 3000, area: 1.0, speed: 6, duration: 3500, knockback: 2, pierce: 99 },
            { damage: 15, amount: 3, cooldown: 3000, area: 1.0, speed: 7, duration: 3500, knockback: 2, pierce: 99 },
            { damage: 15, amount: 4, cooldown: 3000, area: 1.0, speed: 7, duration: 4000, knockback: 2, pierce: 99 },
            { damage: 20, amount: 4, cooldown: 3000, area: 1.0, speed: 8, duration: 4000, knockback: 2, pierce: 99 },
            { damage: 20, amount: 5, cooldown: 3000, area: 1.0, speed: 8, duration: 4500, knockback: 2, pierce: 99 }
        ]
    },
    // 7. SANTA WATER (Zone)
    molotov: {
        key: 'molotov', name: "Molotov", emoji: "🍾",
        description: "Generates damaging zones on the ground.",
        type: 'zone-random',
        requiredPassive: 'attractorb', evolvesTo: 'infernoRing',
        iconColor: '#e53e3e',
        levels: [
            { damage: 10, amount: 1, cooldown: 2500, area: 1.0, speed: 0, duration: 2000, knockback: 0, pierce: 99 },
            { damage: 15, amount: 1, cooldown: 2500, area: 1.2, speed: 0, duration: 2000, knockback: 0, pierce: 99 },
            { damage: 15, amount: 1, cooldown: 2500, area: 1.2, speed: 0, duration: 2500, knockback: 0, pierce: 99 },
            { damage: 20, amount: 1, cooldown: 2500, area: 1.4, speed: 0, duration: 2500, knockback: 0, pierce: 99 },
            { damage: 20, amount: 2, cooldown: 2500, area: 1.4, speed: 0, duration: 2500, knockback: 0, pierce: 99 },
            { damage: 25, amount: 2, cooldown: 2500, area: 1.6, speed: 0, duration: 3000, knockback: 0, pierce: 99 },
            { damage: 25, amount: 2, cooldown: 2500, area: 1.6, speed: 0, duration: 3000, knockback: 0, pierce: 99 },
            { damage: 30, amount: 3, cooldown: 2000, area: 1.8, speed: 0, duration: 3500, knockback: 0, pierce: 99 }
        ]
    }
};

const EVOLVED_WEAPONS = {
    bloodyTail: {
        key: 'bloodyTail', name: "Bloody Tail", emoji: "🩸",
        description: "Steals health from enemies.",
        type: 'directional-melee',
        stats: { damage: 50, amount: 1, cooldown: 1000, area: 1.5, speed: 0, duration: 300, knockback: 10, pierce: 99, lifesteal: 0.1 },
        iconColor: '#b794f4'
    },
    minigunCheese: {
        key: 'minigunCheese', name: "Minigun Cheese", emoji: "🧀",
        description: "Fires a constant stream of cheese.",
        type: 'projectile-nearest',
        stats: { damage: 30, amount: 1, cooldown: 80, area: 1.0, speed: 15, duration: 0, knockback: 2, pierce: 3 },
        iconColor: '#f6ad55'
    },
    thousandDaggers: {
        key: 'thousandDaggers', name: "Thousand Daggers", emoji: "🗡️",
        description: "Unleashes a torrent of daggers.",
        type: 'projectile-facing',
        stats: { damage: 20, amount: 1, cooldown: 50, area: 1.0, speed: 20, duration: 0, knockback: 2, pierce: 4 },
        iconColor: '#718096'
    },
    deathSpiral: {
        key: 'deathSpiral', name: "Death Spiral", emoji: "🪓",
        description: "Axes spiral outward from the center.",
        type: 'projectile-spiral',
        stats: { damage: 60, amount: 9, cooldown: 1000, area: 2.0, speed: 10, duration: 3000, knockback: 10, pierce: 99 },
        iconColor: '#713e2f'
    },
    thunderShield: {
        key: 'thunderShield', name: "Thunder Shield", emoji: "⚡",
        description: "Permanently orbits and damages enemies.",
        type: 'orbit',
        stats: { damage: 30, amount: 6, cooldown: 0, area: 1.2, speed: 10, duration: 999999, knockback: 5, pierce: 99 },
        iconColor: '#63b3ed'
    },
    toxicCloud: {
        key: 'toxicCloud', name: "Toxic Cloud", emoji: "☠️",
        description: "Steals life from enemies inside.",
        type: 'aura',
        stats: { damage: 15, amount: 1, cooldown: 150, area: 2.5, speed: 0, duration: 0, knockback: 2, pierce: 99, lifesteal: 0.05 },
        iconColor: '#9ae6b4'
    },
    infernoRing: {
        key: 'infernoRing', name: "Inferno Ring", emoji: "🔥",
        description: "Zones move toward you and grow.",
        type: 'zone-attract',
        stats: { damage: 40, amount: 4, cooldown: 1500, area: 2.0, speed: 3, duration: 4000, knockback: 0, pierce: 99 },
        iconColor: '#e53e3e'
    }
};

// --- PASSIVE ITEMS DEFINITIONS ---
const PASSIVE_ITEMS = {
    spinach: {
        key: 'spinach', name: "Spinach", emoji: "🍃", description: "Increases damage by 10%.",
        maxLevel: 5,
        apply: (rat) => { rat.damageMultiplier = parseFloat((rat.damageMultiplier + 0.1).toFixed(2)); }
    },
    armor: {
        key: 'armor', name: "Armor", emoji: "🛡️", description: "Reduces incoming damage by 1.",
        maxLevel: 5,
        apply: (rat) => { rat.armor += 1; }
    },
    emptyHeart: {
        key: 'emptyHeart', name: "Hollow Heart", emoji: "❤️", description: "Increases Max Health by 20%.",
        maxLevel: 5,
        apply: (rat) => {
            const boost = Math.floor(rat.maxHp * 0.2);
            rat.maxHp += boost;
            rat.currentHp += boost;
        }
    },
    emptyTome: {
        key: 'emptyTome', name: "Empty Tome", emoji: "📖", description: "Increases attack speed by 8%.",
        maxLevel: 5,
        apply: (rat) => { rat.fireRateReduction = parseFloat((rat.fireRateReduction + 0.08).toFixed(2)); }
    },
    candelabrador: {
        key: 'candelabrador', name: "Candelabrador", emoji: "🕯️", description: "Increases attack range by 10%.",
        maxLevel: 5,
        apply: (rat) => { rat.attackRangeMultiplier = parseFloat((rat.attackRangeMultiplier + 0.1).toFixed(2)); }
    },
    bracer: {
        key: 'bracer', name: "Bracer", emoji: "🧤", description: "Increases projectile speed by 10%.",
        maxLevel: 5,
        apply: (rat) => { /* Not implemented yet globally, but placeholder */ }
    },
    spellbinder: {
        key: 'spellbinder', name: "Spellbinder", emoji: "🔮", description: "Increases duration of weapon effects.",
        maxLevel: 5,
        apply: (rat) => { /* Placeholder for duration */ }
    },
    duplicator: {
        key: 'duplicator', name: "Duplicator", emoji: "💍", description: "Weapons fire more projectiles.",
        maxLevel: 2,
        apply: (rat) => { rat.projectileCountBonus += 1; }
    },
    wings: {
        key: 'wings', name: "Wings", emoji: "🪽", description: "Increases movement speed by 10%.",
        maxLevel: 5,
        apply: (rat) => { rat.baseSpeed = parseFloat((rat.baseSpeed * 1.1).toFixed(1)); }
    },
    attractorb: {
        key: 'attractorb', name: "Attractorb", emoji: "🧲", description: "Increases pickup range.",
        maxLevel: 5,
        apply: (rat) => { rat.magnetRange += 30; }
    },
    clover: {
        key: 'clover', name: "Clover", emoji: "🍀", description: "Increases luck (crit/drops).",
        maxLevel: 5,
        apply: (rat) => { rat.luck += 0.1; } // Placeholder property
    },
    crown: {
        key: 'crown', name: "Crown", emoji: "👑", description: "Gains 8% more experience.",
        maxLevel: 5,
        apply: (rat) => { rat.xpMultiplier = parseFloat((rat.xpMultiplier + 0.08).toFixed(2)); }
    },
    pummarola: {
        key: 'pummarola', name: "Pummarola", emoji: "🍅", description: "Recover 0.2 HP per second.",
        maxLevel: 5,
        apply: (rat) => { rat.hpRegen += 0.2; }
    }
};

// UI Elements
const hud = {
    waveCount: document.getElementById('waveCount'),
    killCount: document.getElementById('killCount'),
    bestKillCount: document.getElementById('bestKillCount'),
    currentHP: document.getElementById('currentHP'),
    maxHP: document.getElementById('maxHP'),
    xpBarFill: document.getElementById('xpBarFill'),
    hpBarFill: document.getElementById('hpBarFill'), // NEW
    currentLevel: document.getElementById('currentLevel'), // NEW
    goldCount: document.getElementById('goldCount'), // NEW
    statSpeed: document.getElementById('statSpeed'),
    statDamage: document.getElementById('statDamage'),
    statArmor: document.getElementById('statArmor'),
    statEvasion: document.getElementById('statEvasion'),
    statProjectiles: document.getElementById('statProjectiles'),
    statAttackSpeed: document.getElementById('statAttackSpeed'),
    statRange: document.getElementById('statRange'),
    statShield: document.getElementById('statShield'),
    // Removed legacy list elements
    weaponSlots: document.getElementById('weaponSlots'),
    passiveSlots: document.getElementById('passiveSlots'),
    buffTimer: document.getElementById('buffTimer')
};
const startScreen = document.getElementById('startScreen');
const characterOptionsDiv = document.getElementById('characterOptions');
const messageBox = document.getElementById('messageBox');
const upgradeScreen = document.getElementById('upgradeScreen');
const upgradeOptionsDiv = document.getElementById('upgradeOptions');
const upgradeScreenTitle = document.getElementById('upgradeScreenTitle');
const restartButton = document.getElementById('restartButton');

// NEW UI elements for multiple purchase logic
const purchaseSummary = document.getElementById('purchaseSummary');
const confirmPurchaseButton = document.getElementById('confirmPurchase');
const skipButton = document.getElementById('skipButton');

// --- SPATIAL GRID FOR COLLISION OPTIMIZATION ---
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    _getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    clear() {
        this.cells.clear();
    }

    insert(entity) {
        // We only insert based on the center point for simplicity, assuming entities are smaller than cells
        // For large entities, we might need to insert into multiple cells, but center point is usually enough for
        // broad phase if we check neighbors.
        // Actually, let's insert into all cells the entity's bounding box touches to be safe.

        const startX = Math.floor((entity.x - entity.radius) / this.cellSize);
        const endX = Math.floor((entity.x + entity.radius) / this.cellSize);
        const startY = Math.floor((entity.y - entity.radius) / this.cellSize);
        const endY = Math.floor((entity.y + entity.radius) / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x},${y}`;
                if (!this.cells.has(key)) {
                    this.cells.set(key, []);
                }
                this.cells.get(key).push(entity);
            }
        }
    }

    retrieve(entity) {
        // Retrieve entities from the cells this entity touches
        const startX = Math.floor((entity.x - entity.radius) / this.cellSize);
        const endX = Math.floor((entity.x + entity.radius) / this.cellSize);
        const startY = Math.floor((entity.y - entity.radius) / this.cellSize);
        const endY = Math.floor((entity.y + entity.radius) / this.cellSize);

        const retrieved = new Set();

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x},${y}`;
                const cell = this.cells.get(key);
                if (cell) {
                    for (const other of cell) {
                        retrieved.add(other);
                    }
                }
            }
        }
        return Array.from(retrieved);
    }
}

// --- SPRITE CACHE FOR RENDERING OPTIMIZATION ---
const spriteCache = {
    canvases: {},

    get(key, width, height, drawFn) {
        if (!this.canvases[key]) {
            const c = document.createElement('canvas');
            c.width = width;
            c.height = height;
            const ctx = c.getContext('2d');
            drawFn(ctx, width / 2, height / 2);
            this.canvases[key] = c;
        }
        return this.canvases[key];
    },

    clear() {
        this.canvases = {};
    }
};


// --- GAME OBJECTS ---

class Entity {
    constructor(x, y, radius, color, speed) {
        // FIX: Removed super() call here
        this.x = x; // Now World X
        this.y = y; // Now World Y
        this.radius = radius;
        this.color = color;
        this.speed = speed;
        this.maxHp = 1;
        this.currentHp = 1;
    }

    // Base draw is now minimal, entities will override this
    draw(context) {
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fill();
    }
}

class Obstacle extends Entity {
    constructor(x, y, radius) {
        super(x, y, radius, '#505050', 0);
        this.color = '#505050';
        this.strokeColor = '#303030';
        this.type = 'rock';

        // NEW: Calculate and store the fixed jagged points once in the constructor
        this.points = [];
        const numPoints = 8 + Math.floor(Math.random() * 4); // 8-11 points
        for(let i = 0; i < numPoints; i++) {
            const angle = i * (Math.PI * 2 / numPoints);
            // Slight randomization in radius for jagged edges
            const r = this.radius * (0.8 + Math.random() * 0.4);
            this.points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
        }
    }

    draw(context) {
        context.save();
        context.translate(this.x, this.y);

        // NEW: Add a drop shadow for depth
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.beginPath();
        context.ellipse(0, this.radius * 0.8, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2);
        context.fill();


        // Draw main rock body (rounded shape with a gradient for texture)
        const gradient = context.createRadialGradient(
            this.radius * 0.3, -this.radius * 0.3, 0,
            0, 0, this.radius
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.strokeColor);

        context.fillStyle = gradient;
        context.strokeStyle = this.strokeColor;
        context.lineWidth = 2;

        // Draw the fixed, irregular shape using stored points
        context.beginPath();

        // --- USE STORED POINTS FOR STATIC SHAPE ---
        if (this.points.length > 0) {
            context.moveTo(this.points[0].x, this.points[0].y);
            // Loop up to the second to last point, then close path
            for(let i = 1; i < this.points.length; i++) {
                context.lineTo(this.points[i].x, this.points[i].y);
            }
        }
        // --- END USE STORED POINTS ---

        context.closePath();
        context.fill();
        context.stroke();

        // Add texture details
        context.fillStyle = 'rgba(0, 0, 0, 0.2)';
        context.beginPath();
        context.arc(this.radius * 0.4, this.radius * 0.4, this.radius * 0.2, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = 'rgba(255, 255, 255, 0.2)';
        context.beginPath();
        context.arc(-this.radius * 0.5, -this.radius * 0.5, this.radius * 0.15, 0, Math.PI * 2);
        context.fill();

        // NEW: Palette-specific visual flair
        context.globalCompositeOperation = 'lighter'; // Additive blending for glows
        let effectApplied = false;
        switch (currentPalette.name) {
            case "Toxic Swamp":
                const toxicGlow = context.createRadialGradient(0, 0, this.radius * 0.5, 0, 0, this.radius);
                toxicGlow.addColorStop(0, 'rgba(154, 230, 180, 0.4)');
                toxicGlow.addColorStop(1, 'rgba(154, 230, 180, 0)');
                context.fillStyle = toxicGlow;
                context.beginPath();
                context.arc(0, 0, this.radius * 1.2, 0, Math.PI * 2);
                context.fill();
                effectApplied = true;
                break;
            case "Ice Cave":
                context.fillStyle = 'rgba(255, 255, 255, 0.3)';
                context.fill(); // Re-fill with a white sheen
                effectApplied = true;
                break;
        }
        if (effectApplied) {
            context.globalCompositeOperation = 'source-over'; // Reset blending mode
        }


        context.restore();
    }
}

class Gem extends Entity {
    constructor(x, y, value) {
        let color = '#4299e1'; // Blue (1 XP)
        if (value >= 10) color = '#48bb78'; // Green (10 XP)
        if (value >= 50) color = '#ed64a6'; // Pink (50 XP)

        super(x, y, 6, color, 0);
        this.value = value;
    }
    draw(context) {
        context.save();
        context.translate(this.x, this.y);
        context.rotate(Date.now() / 1000);
        context.fillStyle = this.color;
        context.beginPath();
        context.moveTo(0, -this.radius);
        context.lineTo(this.radius * 0.7, 0);
        context.lineTo(0, this.radius);
        context.lineTo(-this.radius * 0.7, 0);
        context.fill();
        context.restore();
    }
}

class Particle extends Entity {
    constructor(x, y, color, size = 3) {
        // FIX: Particle must correctly call super() since it extends Entity
        super(x, y, size, color, 0);

        this.velocity = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };
        this.life = 60; // Frames of life
        this.maxLife = 60;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.life--;
        return this.life <= 0; // Returns true if particle is dead
    }

    draw(context) {
        // Fade effect
        context.globalAlpha = this.life / this.maxLife;
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1.0; // Reset alpha
    }
}

class HealthDrop extends Entity {
    constructor(x, y) {
        super(x, y, 8, '#48bb78', 0); // Green color, stationary
        this.healAmount = 150; // MODIFIED: Increased heal amount
        this.color = '#48bb78';
    }

    draw(context) {
        // Draw as a custom green plus sign
        context.fillStyle = this.color;
        context.strokeStyle = '#fff';
        context.lineWidth = 2;

        // Vertical bar
        context.fillRect(this.x - 2, this.y - 6, 4, 12);
        // Horizontal bar
        context.fillRect(this.x - 6, this.y - 2, 12, 4);

        // Add a white stroke to the edges for visibility
        context.strokeRect(this.x - 2, this.y - 6, 4, 12);
        context.strokeRect(this.x - 6, this.y - 2, 12, 4);
    }
}

// NEW CLASS: Explosive Bullet Drop
class ExplosiveBulletDrop extends Entity {
    constructor(x, y) {
        super(x, y, 8, '#ff4500', 0); // Red-Orange color
        this.buffDuration = 10000; // 10 seconds in milliseconds
        this.color = '#ff4500';
    }

    draw(context) {
        // Draw as a stylized projectile with a flash/explosion hint
        context.save();
        context.translate(this.x, this.y);

        // Base projectile body (small circle)
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(0, 0, this.radius, 0, Math.PI * 2);
        context.fill();

        // Flash lines (Yellow/White)
        context.strokeStyle = '#fff';
        context.lineWidth = 1;
        context.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2;
            context.moveTo(0, 0);
            context.lineTo(Math.cos(angle) * (this.radius + 4), Math.sin(angle) * (this.radius + 4));
        }
        context.stroke();

        context.restore();
    }
}
// END NEW CLASS

// NEW CLASS: Ice Power-up Drop
class IcePowerupDrop extends Entity {
    constructor(x, y) {
        super(x, y, 8, '#4299e1', 0); // Blue color
        this.buffDuration = 5000; // 5 seconds
    }
    draw(context) {
        // Draw as a rotating blue crystal/gem
        context.save();
        context.translate(this.x, this.y);
        context.rotate(Date.now() / 500); // Continuous rotation

        context.fillStyle = '#63b3ed';
        context.strokeStyle = '#fff';
        context.lineWidth = 1;

        // Draw diamond shape
        context.beginPath();
        context.moveTo(0, -this.radius);
        context.lineTo(this.radius, 0);
        context.lineTo(0, this.radius);
        context.lineTo(-this.radius, 0);
        context.closePath();
        context.fill();
        context.stroke();

        context.restore();
    }
}

// NEW CLASS: Extreme Fire Speed Power-up Drop
class SpeedPowerupDrop extends Entity {
    constructor(x, y) {
        super(x, y, 8, '#ff4500', 0); // Red/Orange
        this.buffDuration = 5000; // 5 seconds
    }
    draw(context) {
        // Draw as a stylized red lightning bolt
        context.save();
        context.translate(this.x, this.y);
        context.rotate(Math.sin(Date.now() / 150) * 0.2); // Wiggle

        context.fillStyle = '#ff4500';
        context.strokeStyle = '#ffc700'; // Yellow outline
        context.lineWidth = 1.5;

        // Draw Z shape (lightning)
        context.beginPath();
        context.moveTo(-5, -5);
        context.lineTo(5, -5);
        context.lineTo(0, 5);
        context.lineTo(-10, 5);
        context.lineTo(-5, -5);
        context.closePath();
        context.fill();
        context.stroke();

        context.restore();
    }
}

// NEW CLASS: Bomb Drop (Nuclear Option)
class BombDrop extends Entity {
    constructor(x, y) {
        super(x, y, 10, '#000000', 0);
        this.color = '#000000';
    }
    draw(context) {
        // Draw as a pulsing black/yellow bomb icon
        context.save();
        context.translate(this.x, this.y);
        const pulse = Math.sin(Date.now() / 150) * 0.5 + 1;

        // Bomb body
        context.fillStyle = '#1a1a1a';
        context.beginPath();
        context.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
        context.fill();

        // Fuse/Warning sign (yellow)
        context.fillStyle = '#fbd38d';
        context.fillRect(-2, -this.radius * pulse * 1.5, 4, 10);

        // Warning stripes
        context.strokeStyle = '#ffc700';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(-this.radius * pulse * 0.8, -this.radius * pulse * 0.5);
        context.lineTo(this.radius * pulse * 0.8, this.radius * pulse * 0.5);
        context.stroke();

        context.restore();
    }
}

// NEW CLASS: Treasure Chest
class Chest extends Entity {
    constructor(x, y) {
        super(x, y, 20, '#d69e2e', 0); // Gold color
        this.color = '#d69e2e';
    }
    draw(context) {
        context.save();
        context.translate(this.x, this.y);

        // Glow
        const pulse = Math.sin(Date.now() / 200) * 5;
        context.shadowBlur = 20 + pulse;
        context.shadowColor = '#ecc94b';

        // Box
        context.fillStyle = '#744210';
        context.fillRect(-15, -10, 30, 20);

        // Lid (gold trim)
        context.fillStyle = '#d69e2e';
        context.fillRect(-15, -10, 30, 6);
        context.fillRect(-4, -10, 8, 20); // Lock

        context.restore();
    }
}

// NEW CLASS: Damage Zone (Molotov/Holy Water)
class ZoneEntity extends Entity {
    constructor(x, y, radius, damage, duration, color, weaponKey) {
        super(x, y, radius, color, 0);
        this.damage = damage;
        this.maxDuration = duration;
        this.duration = duration;
        this.weaponKey = weaponKey;
        this.hitTimer = 0; // Ticks damage
    }

    update(deltaTime) {
        this.duration -= deltaTime;
        return this.duration <= 0;
    }

    draw(context) {
        context.save();
        context.translate(this.x, this.y);

        // Pulsing / Fading
        const alpha = Math.min(1, this.duration / 500) * (0.5 + Math.sin(Date.now() / 100) * 0.2);
        context.globalAlpha = alpha;
        context.fillStyle = this.color;

        context.beginPath();
        context.ellipse(0, 0, this.radius, this.radius * 0.6, 0, 0, Math.PI * 2);
        context.fill();

        // Flames/Particles effect
        if (Math.random() > 0.5) {
             context.fillStyle = '#ffc700'; // Yellow sparks
             const px = (Math.random() - 0.5) * this.radius * 1.5;
             const py = (Math.random() - 0.5) * this.radius;
             context.fillRect(px, py, 2, 2);
        }

        context.restore();
    }
}

// END NEW POWERUP CLASSES

class Rat extends Entity {
    constructor(characterKey) {
        super(WORLD_CENTER_X, WORLD_CENTER_Y, 15, null, 4); // Initialize at world center

        const initialStats = CHARACTERS[characterKey].initialStats;
        const colors = CHARACTERS[characterKey].ratColors;

        this.maxHp = initialStats.maxHp;
        this.currentHp = initialStats.maxHp;
        this.baseSpeed = initialStats.baseSpeed;
        this.damageMultiplier = initialStats.damageMultiplier;
        this.armor = initialStats.armor;
        this.evasion = initialStats.evasion;
        // NEW RANGED STATS
        this.projectileCountBonus = initialStats.projectileCountBonus;
        this.fireRateReduction = initialStats.fireRateReduction;
        this.attackRangeMultiplier = initialStats.attackRangeMultiplier;
        this.shield = initialStats.shield; // NEW SHIELD STAT
        this.bounceCount = initialStats.bounceCount; // NEW GLOBAL BOUNCE STAT
        this.lifestealPercentage = initialStats.lifestealPercentage; // NEW LIFESTEAL STAT

        // NEW AFFINITY STAT
        this.meleeRangeMultiplier = initialStats.meleeRangeMultiplier;

        // NEW CURRENCY STAT (Used as score now)
        this.currency = initialStats.currency;
        // NEW WEAPON SLOTS
        this.maxWeapons = 6; // Standard Survivor limit
        this.maxPassives = 6; // Standard Survivor limit

        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 10;
        this.xpMultiplier = 1.0; // New XP Multiplier
        this.magnetRange = 50;   // New Magnet Range
        this.luck = 1.0;         // New Luck stat
        this.hpRegen = 0;        // New HP Regen

        this.moveDirection = { x: 0, y: 0 };
        this.damageFlashTimer = 0;
        this.animationFrame = 0;
        this.facingRight = true;
        this.lastFacingRight = true; // For stationary aiming

        this.weapons = []; // Array of { key, level, ...stats, cooldownTimer }
        this.passives = []; // Array of { key, level, name }

        // Set character-specific colors
        this.ratColor = colors.main;
        this.ratLightFur = colors.light;
        this.ratDetailColor = colors.detail;

        // NEW BUFF TRACKING
        this.buffs = {
            explosiveBullets: 0, // Milliseconds remaining
            iceAura: 0,
            extremeSpeed: 0 // New speed buff
        };

        // ORBITAL & AURA MANAGERS
        this.activeOrbits = []; // { weaponKey, angle, projectiles: [] }
        this.activeAuras = [];  // { weaponKey, timer }

        this.addWeapon(CHARACTERS[characterKey].starterWeapon);
    }

    addWeapon(weaponKey) {
        // Check if evolved version (not in WEAPONS usually, but passed directly?)
        // For now assume standard weapons from WEAPONS or EVOLVED_WEAPONS
        let def = WEAPONS[weaponKey] || EVOLVED_WEAPONS[weaponKey];
        if (!def) return;

        const existingWeapon = this.weapons.find(w => w.key === weaponKey);

        if (existingWeapon) {
            // Upgrade
            if (existingWeapon.level < 8) {
                existingWeapon.level++;
                this.updateWeaponStats(existingWeapon, def);
            }
        } else {
            // New
            if (this.weapons.length >= this.maxWeapons) return;

            const newWeapon = {
                key: weaponKey,
                level: 1,
                cooldownTimer: 0,
                evolved: !!EVOLVED_WEAPONS[weaponKey]
            };
            this.updateWeaponStats(newWeapon, def);
            this.weapons.push(newWeapon);
        }
    }

    updateWeaponStats(weapon, def) {
        let stats;
        if (weapon.evolved) {
             stats = def.stats; // Evolved weapons have a single 'stats' object
             weapon.level = 8; // Force level 8 for evolved display
        } else {
             stats = def.levels[weapon.level - 1];
        }

        weapon.damage = stats.damage;
        weapon.amount = stats.amount;
        weapon.cooldown = stats.cooldown;
        weapon.area = stats.area;
        weapon.speed = stats.speed;
        weapon.duration = stats.duration;
        weapon.knockback = stats.knockback;
        weapon.pierce = stats.pierce;
        weapon.type = def.type;
        weapon.lifesteal = stats.lifesteal || 0;
    }

    addPassive(passiveKey) {
        if (!PASSIVE_ITEMS[passiveKey]) return;

        const existingPassive = this.passives.find(p => p.key === passiveKey);

        if (existingPassive) {
            if (existingPassive.level < PASSIVE_ITEMS[passiveKey].maxLevel) {
                existingPassive.level++;
                PASSIVE_ITEMS[passiveKey].apply(this);
            }
        } else {
            if (this.passives.length < this.maxPassives) {
                this.passives.push({ key: passiveKey, level: 1 });
                PASSIVE_ITEMS[passiveKey].apply(this);
            }
        }
    }

    // NEW: Add currency handling
    gainCurrency(amount) {
        this.currency += amount;
    }

    gainXp(amount, game) {
        this.xp += amount * this.xpMultiplier;
        while (this.xp >= this.xpToNextLevel) {
            this.levelUp(game);
        }
    }

    heal(amount) {
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    }

    // NEW: Apply explosive bullet buff
    applyExplosiveBuff(duration) {
        this.buffs.explosiveBullets = duration;
    }

    // NEW: Apply Ice Aura buff
    applyIceAura(duration, game) {
        this.buffs.iceAura = duration;
        if (game && game.enemies) {
            game.enemies.forEach(e => e.isSlowed = true);
        }
    }

    // NEW: Apply Extreme Speed buff
    applyExtremeSpeed(duration) {
        this.buffs.extremeSpeed = duration;
    }


    levelUp(game) {
        this.xp -= this.xpToNextLevel;
        this.level += 1;

        // NEW leveling curve: Standard survivor scaling
        // Base 10, increases by 10 each level, plus small exponential
        this.xpToNextLevel = Math.floor(this.xpToNextLevel + 10 + (this.level * 2));

        if (game) game.showLevelUpScreen();
    }

    update(game, deltaTime) {
        const totalSpeed = this.baseSpeed * (deltaTime / 16.66);
        let newX = this.x + this.moveDirection.x * totalSpeed;
        let newY = this.y + this.moveDirection.y * totalSpeed;

        // Update facing direction based on horizontal movement
        if (this.moveDirection.x > 0) {
            this.facingRight = true;
            this.lastFacingRight = true;
        } else if (this.moveDirection.x < 0) {
            this.facingRight = false;
            this.lastFacingRight = false;
        }


        // --- WORLD BOUNDARY CLAMPING ---
        const distToCenter = Math.hypot(newX - WORLD_CENTER_X, newY - WORLD_CENTER_Y);
        if (distToCenter + this.radius > WORLD_RADIUS) {
            const angle = Math.atan2(newY - WORLD_CENTER_Y, newX - WORLD_CENTER_X);
            newX = WORLD_CENTER_X + Math.cos(angle) * (WORLD_RADIUS - this.radius);
            newY = WORLD_CENTER_Y + Math.sin(angle) * (WORLD_RADIUS - this.radius);
        }

        this.x = newX; // Now updating World X
        this.y = newY; // Now updating World Y
        // --- END WORLD CLAMPING ---

        if (this.moveDirection.x !== 0 || this.moveDirection.y !== 0) {
            this.animationFrame++;
        }

        // NEW: Update Buff timers
        this.buffs.explosiveBullets = Math.max(0, this.buffs.explosiveBullets - deltaTime);
        this.buffs.iceAura = Math.max(0, this.buffs.iceAura - deltaTime);
        this.buffs.extremeSpeed = Math.max(0, this.buffs.extremeSpeed - deltaTime);

        // Debuff removal: remove slow effect if timer hits zero
        if (this.buffs.iceAura === 0 && game && game.enemies) {
             game.enemies.forEach(e => e.isSlowed = false);
        }

        // --- NEW WEAPON UPDATE ---
        this.updateWeapons(game, deltaTime);
    }

    updateWeapons(game, deltaTime) {
        // 1. Update Persistent Effects
        this.updateActiveOrbits(game, deltaTime);
        this.updateActiveAuras(game, deltaTime);

        // 2. Calculate Fire Rate Modifier
        let rateMod = 1.0;
        if (this.fireRateReduction > 0) rateMod = 1.0 / this.fireRateReduction;

        if (this.buffs.extremeSpeed > 0) rateMod *= 1.5;
        const totalSpeedMult = this.fireRateReduction * rateMod;

        // 3. Update Weapons
        this.weapons.forEach(weapon => {
            weapon.cooldownTimer -= deltaTime * totalSpeedMult;

            if (weapon.cooldownTimer <= 0) {
                this.fireWeapon(game, weapon);
                weapon.cooldownTimer = weapon.cooldown;
            }
        });
    }

    // --- WEAPON SYSTEM ---

    updateActiveOrbits(game, deltaTime) {
        this.activeOrbits = this.activeOrbits.filter(orbit => {
            orbit.elapsed += deltaTime;
            if (orbit.duration < 900000 && orbit.elapsed > orbit.duration) {
                return false; // Expired
            }

            // Update rotation
            orbit.angle += (orbit.speed * deltaTime / 1000);

            // Update projectiles positions & Collisions
            const count = orbit.projectiles.length;
            const radius = 100 * orbit.area;
            const now = Date.now();

            orbit.projectiles.forEach((p, i) => {
                const theta = orbit.angle + (i * (Math.PI * 2 / count));
                p.x = this.x + Math.cos(theta) * radius;
                p.y = this.y + Math.sin(theta) * radius;
                p.radius = 15 * orbit.area; // Size scaling

                // Collision Logic
                // We use the spatial grid to find nearby enemies to the PROJECTILE
                const targets = game.spatialGrid.retrieve(p);
                targets.forEach(e => {
                    if (e instanceof Enemy && !e.isDead) {
                        const d = Math.hypot(p.x - e.x, p.y - e.y);
                        if (d < p.radius + e.radius) {
                            if (!e.hitTimers) e.hitTimers = {};
                            // Hit rate limit per enemy (e.g. 300ms)
                            if (!e.hitTimers[orbit.weapon.key] || now - e.hitTimers[orbit.weapon.key] > 300) {
                                e.currentHp -= orbit.damage;
                                e.hitTimers[orbit.weapon.key] = now;

                                const ang = Math.atan2(e.y - this.y, e.x - this.x);
                                e.x += Math.cos(ang) * orbit.knockback;
                                e.y += Math.sin(ang) * orbit.knockback;

                                if (e.currentHp <= 0) game.handleEnemyDefeat(e);
                            }
                        }
                    }
                });
            });
            return true;
        });
    }

    updateActiveAuras(game, deltaTime) {
        const auraWeapons = this.weapons.filter(w => w.type === 'aura');
        const now = Date.now();

        auraWeapons.forEach(w => {
            const stats = this.getCalculatedStats(w);
            const radius = 80 * stats.area;

            // For drawing
            this.auraRadius = radius;
            this.auraColor = WEAPONS[w.key].iconColor;

            const nearby = game.spatialGrid.retrieve(this);

            nearby.forEach(e => {
                if (e instanceof Enemy && !e.isDead) {
                    const d = Math.hypot(e.x - this.x, e.y - this.y);
                    if (d < radius + e.radius) {
                        if (!e.auraHitTimer || now - e.auraHitTimer > w.cooldown) {
                            e.currentHp -= stats.damage;
                            e.auraHitTimer = now;

                            const ang = Math.atan2(e.y - this.y, e.x - this.x);
                            e.x += Math.cos(ang) * stats.knockback;
                            e.y += Math.sin(ang) * stats.knockback;

                            if (w.lifesteal) this.heal(stats.damage * w.lifesteal);

                            if (e.currentHp <= 0) game.handleEnemyDefeat(e);
                        }
                    }
                }
            });
        });

        if (auraWeapons.length === 0) this.auraRadius = 0;
    }

    fireWeapon(game, weapon) {
        const stats = this.getCalculatedStats(weapon);

        switch (weapon.type) {
            case 'projectile-nearest':
                const targets = game.getNNearestEnemies(stats.amount);
                targets.forEach(target => {
                    const angle = Math.atan2(target.y - this.y, target.x - this.x);
                    this.spawnProjectile(game, weapon, stats, angle);
                });
                break;

            case 'projectile-facing':
                const baseAngle = this.lastFacingRight ? 0 : Math.PI;
                const spreadTotal = 0.1 * (stats.amount - 1);
                const startAngle = baseAngle - spreadTotal / 2;

                for(let i=0; i<stats.amount; i++) {
                    const angle = startAngle + (i * 0.1);
                    this.spawnProjectile(game, weapon, stats, angle);
                }
                break;

            case 'directional-melee':
                game.meleeAttack(this.x, this.y, {
                    radius: 120 * stats.area,
                    arcAngle: Math.PI,
                    damage: stats.damage,
                    knockback: stats.knockback,
                    stackDamageFactor: 1,
                    lifesteal: weapon.lifesteal,
                    forcedAngle: this.lastFacingRight ? 0 : Math.PI
                });
                break;

            case 'projectile-upward':
                for(let i=0; i<stats.amount; i++) {
                    const angle = -Math.PI / 2; // Up
                    this.spawnProjectile(game, weapon, stats, angle + (Math.random()-0.5)*0.5, 10); // Gravity 10
                }
                break;

            case 'projectile-spiral': // Death Spiral
                 for(let i=0; i<stats.amount; i++) {
                    const angle = (Date.now() / 200) + (i * (Math.PI * 2 / stats.amount));
                    this.spawnProjectile(game, weapon, stats, angle);
                }
                break;

            case 'orbit':
                // Clear existing orbit for this weapon to refresh it
                this.activeOrbits = this.activeOrbits.filter(o => o.weapon.key !== weapon.key);

                const projectiles = [];
                for(let i=0; i<stats.amount; i++) {
                    projectiles.push({ x: 0, y: 0, radius: 10, color: WEAPONS[weapon.key].iconColor || '#fff' });
                }

                this.activeOrbits.push({
                    weapon: weapon,
                    projectiles: projectiles,
                    duration: stats.duration,
                    elapsed: 0,
                    angle: 0,
                    speed: stats.speed,
                    area: stats.area,
                    damage: stats.damage,
                    knockback: stats.knockback
                });
                break;

            case 'zone-random':
            case 'zone-attract': // Inferno Ring
                for(let i=0; i<stats.amount; i++) {
                    const r = Math.random() * 200;
                    const theta = Math.random() * Math.PI * 2;
                    const zx = this.x + Math.cos(theta) * r;
                    const zy = this.y + Math.sin(theta) * r;

                    game.pickups.push(new ZoneEntity(zx, zy, 50 * stats.area, stats.damage, stats.duration, WEAPONS[weapon.key].iconColor, weapon.key));
                }
                break;
        }
    }

    spawnProjectile(game, weapon, stats, angle, gravity = 0) {
        const p = new Projectile(
            this.x, this.y,
            6 + (stats.area * 2), // Radius
            WEAPONS[weapon.key].iconColor || '#fff',
            stats.speed,
            angle,
            stats.damage,
            700 * (1 + stats.duration/1000), // Range/Duration proxy
            false,
            0,
            weapon.key,
            gravity
        );
        p.pierce = stats.pierce;
        game.projectiles.push(p);
    }

    getCalculatedStats(weapon) {
        return {
            damage: weapon.damage * this.damageMultiplier,
            amount: weapon.amount + this.projectileCountBonus,
            area: weapon.area * this.attackRangeMultiplier,
            speed: weapon.speed,
            duration: weapon.duration,
            knockback: weapon.knockback,
            cooldown: weapon.cooldown,
            pierce: weapon.pierce || 0
        };
    }


    drawRatBody(context) {
        const isMoving = this.moveDirection.x !== 0 || this.moveDirection.y !== 0;
        // NEW: Add idle bobbing animation
        const idleBob = isMoving ? 0 : Math.sin(Date.now() / 200) * 1.5;

        context.save();
        // Apply bob to entire rat drawing
        context.translate(this.x, this.y + idleBob);

        const bodyLength = this.radius * 2.5;
        const bodyHeight = this.radius * 1.2;
        const headRadius = this.radius * 0.8;

        // NEW: Add a drop shadow for depth, drawn first
        context.beginPath();
        context.ellipse(0, bodyHeight / 2 + 3, bodyLength / 2, bodyHeight / 4, 0, 0, Math.PI * 2);
        context.fillStyle = 'rgba(0, 0, 0, 0.2)';
        context.fill();

        // Flip horizontally if facing left
        if (!this.facingRight) {
            context.scale(-1, 1);
        }

        // --- Running Animation Offset for Legs (Horizontal Stride) ---
        const strideAmplitude = 4;
        // Use sine wave for smooth, continuous running animation
        const strideOffset = isMoving
            ? Math.sin(this.animationFrame * 0.4) * strideAmplitude
            : 0;

        // 1. Draw Tail (Simple curved line)
        context.strokeStyle = this.ratDetailColor;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-bodyLength / 2, 0);
        context.bezierCurveTo(-bodyLength * 0.8, -bodyHeight * 0.5, -bodyLength * 0.8, bodyHeight * 0.5, -bodyLength * 2, 0);
        context.stroke();

        // 2. Draw Torso (Use gradient for dimension)
        const gradientTorso = context.createRadialGradient(
            0, 0, 1, // Inner circle (light source)
            0, 0, bodyLength / 2 // Outer circle
        );
        gradientTorso.addColorStop(0, this.ratLightFur); // Lighter center
        gradientTorso.addColorStop(1, this.ratColor); // Darker edges

        context.fillStyle = gradientTorso;
        context.beginPath();
        context.ellipse(0, 0, bodyLength / 2, bodyHeight / 2, 0, 0, Math.PI * 2);
        context.fill();

        // 3. Draw Head (Use gradient)
        const gradientHead = context.createRadialGradient(
            bodyLength * 0.4 + headRadius * 0.3, -headRadius * 0.3, 1, // Light source
            bodyLength * 0.4, 0, headRadius // Outer area
        );
        gradientHead.addColorStop(0, this.ratLightFur);
        gradientHead.addColorStop(1, this.ratColor);

        context.fillStyle = gradientHead;
        context.beginPath();
        context.arc(bodyLength * 0.4, 0, headRadius, 0, Math.PI * 2);
        context.fill();

        // 4. Draw Ear
        context.fillStyle = this.ratLightFur;
        context.beginPath();
        context.arc(bodyLength * 0.3 + headRadius * 0.2, -headRadius * 0.7, headRadius * 0.5, 0, Math.PI * 2);
        context.fill();

        // 5. Draw Eye
        context.fillStyle = this.ratDetailColor;
        context.beginPath();
        context.arc(bodyLength * 0.4 + headRadius * 0.6, -headRadius * 0.3, headRadius * 0.15, 0, Math.PI * 2);
        context.fill();

        // 6. Draw Legs and Paws (Improved look)
        context.fillStyle = this.ratLightFur; // Light pink/flesh color for paws
        const legSize = 3;
        const pawSize = 2;
        const legY = bodyHeight * 0.4;

        // Front Leg/Paw
        context.fillStyle = this.ratDetailColor;
        context.beginPath();
        context.arc(bodyLength * 0.2 + strideOffset, legY, legSize, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = this.ratLightFur;
        context.beginPath();
        context.arc(bodyLength * 0.2 + strideOffset - 4, legY + 2, pawSize, 0, Math.PI * 2);
        context.fill();

        // Back Leg/Paw
        context.fillStyle = this.ratDetailColor;
        context.beginPath();
        context.arc(-bodyLength * 0.2 - strideOffset, legY, legSize, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = this.ratLightFur;
        context.beginPath();
        context.arc(-bodyLength * 0.2 - strideOffset - 4, legY + 2, pawSize, 0, Math.PI * 2);
        context.fill();

        // 7. Draw Whiskers (thin black lines)
        context.strokeStyle = this.ratDetailColor;
        context.lineWidth = 0.5;
        const noseX = bodyLength * 0.4 + headRadius * 0.7;
        const noseY = 0;

        for(let i=0; i<3; i++) {
            context.beginPath();
            context.moveTo(noseX, noseY);
            context.lineTo(noseX + 10, noseY - 5 + i * 5);
            context.stroke();
        }

        context.restore();
    }

    draw(context) {
        // --- Buff Glow ---
        if (this.buffs.explosiveBullets > 0) {
            const alpha = Math.sin(Date.now() / 50) * 0.5 + 0.5; // Pulsing effect
            context.save();
            context.globalAlpha = alpha * 0.6;
            context.fillStyle = '#ff4500'; // Red-orange glow
            context.beginPath();
            context.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
            context.fill();
            context.restore();
        } else if (this.buffs.extremeSpeed > 0) {
            // Attack speed buff visual
            const alpha = Math.sin(Date.now() / 30) * 0.5 + 0.5;
            context.save();
            context.globalAlpha = alpha * 0.5;
            context.fillStyle = '#ffc700'; // Yellow/Gold glow
            context.beginPath();
            context.arc(this.x, this.y, this.radius * 1.8, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }

        // --- Damage Flash Effect ---
        if (this.damageFlashTimer > 0) {
            context.globalAlpha = 0.3 + (this.damageFlashTimer % 2) * 0.7;
            this.damageFlashTimer--;
        }

        // Draw Aura
        if (this.auraRadius > 0) {
            context.save();
            context.globalAlpha = 0.2;
            context.fillStyle = this.auraColor || '#fff';
            context.beginPath();
            context.arc(this.x, this.y, this.auraRadius, 0, Math.PI * 2);
            context.fill();
            context.globalAlpha = 1.0;
            context.restore();
        }

        // Draw Orbits
        if (this.activeOrbits) {
            this.activeOrbits.forEach(orbit => {
                orbit.projectiles.forEach(p => {
                    context.save();
                    context.translate(p.x, p.y);
                    context.fillStyle = p.color || '#fff';
                    // Draw book/shield shape
                    context.beginPath();
                    context.rect(-p.radius/2, -p.radius, p.radius, p.radius * 1.5);
                    context.fill();
                    context.restore();
                });
            });
        }

        this.drawRatBody(context);

        context.globalAlpha = 1.0;

        // Draw HP Bar
        const hpWidth = 40;
        const hpHeight = 5;
        const hpRatio = this.currentHp / this.maxHp;

        context.fillStyle = '#4a5568';
        context.fillRect(this.x - hpWidth / 2, this.y - this.radius - 10, hpWidth, hpHeight);

        const hpColor = hpRatio > 0.5 ? '#48bb78' : (hpRatio > 0.25 ? '#fbd38d' : '#f56565');
        context.fillStyle = hpColor;
        context.fillRect(this.x - hpWidth / 2, this.y - this.radius - 10, hpWidth * hpRatio, hpHeight);

        // NEW: Draw Shield Bar if present
        if (this.shield > 0) {
            const SHIELD_HP_MAX = this.maxHp + this.shield; // Temporary Max HP + Shield value for calculation
            const shieldRatio = this.shield / SHIELD_HP_MAX;
            const shieldColor = '#4299e1'; // Blue

            context.fillStyle = '#4a5568';
            context.fillRect(this.x - hpWidth / 2, this.y - this.radius - 17, hpWidth, hpHeight); // Above HP bar

            context.fillStyle = shieldColor;
            context.fillRect(this.x - hpWidth / 2, this.y - this.radius - 17, hpWidth * shieldRatio, hpHeight);
        }
    }
}

class EnemyProjectile extends Entity {
    constructor(x, y, radius, color, speed, angle, damage) {
        super(x, y, radius, color, speed);
        this.dx = Math.cos(angle) * speed;
        this.dy = Math.sin(angle) * speed;
        this.damage = damage;
    }

    update(deltaTime) {
        this.x += this.dx * (deltaTime / 16.66);
        this.y += this.dy * (deltaTime / 16.66);
        const distToCenter = Math.hypot(this.x - WORLD_CENTER_X, this.y - WORLD_CENTER_Y);
        return distToCenter > WORLD_RADIUS; // Remove if out of world
    }

    draw(context) {
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fill();
    }
}

// --- RE-INTRODUCED BASE ENEMY CLASS ---
class Enemy extends Entity {
    constructor(x, y, radius = 10, waveFactor = 1) {
        super(x, y, radius, null, 2.0); // Color handled by subclass/palette

        // --- MODIFIED HEALTH SCALING FOR EXTREME DIFFICULTY ---

        // 1. Set a higher base linear increase for "way more health"
        let baseHp = 50 + (waveFactor - 1) * 80; // Increased base HP and steeper linear scaling

        let healthMultiplier = 1.0;

        // 2. Apply exponential doubling starting from Wave 5
        if (waveFactor >= 5) {
            // Wave 5 = 2^1, Wave 6 = 2^1, Wave 7 = 2^2, Wave 8 = 2^2, etc.
            // Calculate how many times we've passed a 2-wave increment starting from Wave 5
            const doublingCycles = Math.floor((waveFactor - 5) / 2) + 1;
            healthMultiplier = Math.pow(2, doublingCycles);
        }

        this.maxHp = Math.floor(baseHp * healthMultiplier);
        // --- END MODIFIED HEALTH SCALING ---

        this.currentHp = this.maxHp;

        this.damage = 5 + (waveFactor - 1) * 7;

        // Calculate base XP using a formula tied to scaling factor
        this.xpValue = 5 + (waveFactor - 1) * 3;

        this.lastAttackTime = 0; // For attack timers
        this.isSlowed = false; // NEW: Slow status from Ice Aura
        this.isDead = false; // NEW: Flag for clean deletion

        // Color is assigned in subclass constructor, which is called after super()
    }

    _drawHpBar(context, hpWidth = 25, hpHeight = 3, yOffset = -10) {
        const hpRatio = this.currentHp / this.maxHp;

        context.fillStyle = '#4a5568';
        // Background bar drawn relative to the translated origin (0, 0)
        context.fillRect(-hpWidth / 2, -this.radius + yOffset, hpWidth, hpHeight);

        const hpColor = hpRatio > 0.5 ? '#48bb78' : (hpRatio > 0.2 ? '#fbd38d' : '#f56565');
        context.fillStyle = hpColor;
        // Fill bar drawn relative to the translated origin (0, 0)
        // Use Math.max(0) to ensure the bar doesn't draw backwards due to tiny negative numbers
        context.fillRect(-hpWidth / 2, -this.radius + yOffset, Math.max(0, hpWidth * hpRatio), hpHeight);
    }

    update(game, player, deltaTime) {
        let actualSpeed = this.speed;
        const SLOW_FACTOR = 0.5; // 50% slow

        // NEW: Apply Ice Aura slow effect
        if (this.isSlowed) {
            actualSpeed *= SLOW_FACTOR;
        }

        const totalSpeed = actualSpeed * (deltaTime / 16.66);

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.hypot(dx, dy);

        // --- OBSTACLE COLLISION CHECK for Enemy Movement ---
        let hitObstacle = false;
        if (distance > 0 && game && game.obstacles) {
            game.obstacles.forEach(o => {
                const nextX = this.x + (dx / distance) * totalSpeed;
                const nextY = this.y + (dy / distance) * totalSpeed;
                const dist = Math.hypot(nextX - o.x, nextY - o.y);
                if (dist < this.radius + o.radius) {
                    hitObstacle = true;
                }
            });
        }

        if (hitObstacle) {
            // Stop movement if heading into an obstacle
            return;
        }
        // --- END OBSTACLE CHECK ---


        if (distance > 0) {
            this.x += (dx / distance) * totalSpeed;
            this.y += (dy / distance) * totalSpeed;
        }
    }

    // NEW VISUALS: Redesigned enemy drawing logic
    draw(context) {
        context.save();
        context.translate(this.x, this.y);

        const bodySegments = 8;
        const pathLength = this.radius * 2;
        const wave = Date.now() / 200 + this.x / 10;

        // --- Draw Ice Aura Visual (if slowed) ---
        if (this.isSlowed) {
             const alpha = Math.sin(Date.now() / 100) * 0.3 + 0.4;
             context.fillStyle = `rgba(66, 153, 225, ${alpha})`;
             context.beginPath();
             context.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
             context.fill();
        }

        // Calculate positions
        const segmentPositions = [];
        for (let i = 0; i < bodySegments; i++) {
            const progress = i / (bodySegments - 1);
            const x = (progress - 0.5) * pathLength;
            const y = Math.sin(progress * Math.PI * 2 + wave) * this.radius * 0.5;
            segmentPositions.push({ x, y });
        }

        // Draw shadow first (from back to front)
        context.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let i = bodySegments - 1; i >= 0; i--) {
            const seg = segmentPositions[i];
            context.beginPath();
            context.arc(seg.x, seg.y + 4, this.radius, 0, Math.PI * 2);
            context.fill();
        }

        // OPTIMIZATION: Use cached sprite for segments
        // Key based on color and radius
        const segmentKey = `seg_${this.color}_${this.radius}`;
        const segmentSize = this.radius * 2.5; // Slightly larger for padding

        const segmentSprite = spriteCache.get(segmentKey, segmentSize, segmentSize, (ctx, cx, cy) => {
            const gradient = ctx.createRadialGradient(cx - this.radius * 0.2, cy - this.radius * 0.2, 1, cx, cy, this.radius);
            gradient.addColorStop(0, '#ffffff44'); // Highlight
            gradient.addColorStop(0.5, this.color);
            gradient.addColorStop(1, this.strokeColor || this.color);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, this.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw body segments using cached sprite
        for (let i = bodySegments - 1; i >= 0; i--) {
            const seg = segmentPositions[i];
            context.drawImage(segmentSprite, seg.x - segmentSize/2, seg.y - segmentSize/2);
        }

        // Draw Head (Could also be cached, but has eyes, slightly more complex.
        // For now, let's keep head dynamic or cache it separately if needed.
        // Drawing one head is cheap compared to 8 gradient segments.)
        const head = segmentPositions[bodySegments - 1];

        // Simple head draw (optimized gradient)
        // Check if we can reuse the segment sprite for the base head?
        // The head is radius * 1.2.

        const headGradient = context.createRadialGradient(head.x - this.radius * 0.3, head.y - this.radius * 0.3, 1, head.x, head.y, this.radius * 1.2);
        headGradient.addColorStop(0, '#ffffff66');
        headGradient.addColorStop(0.5, this.color);
        headGradient.addColorStop(1, this.strokeColor || this.color);

        context.fillStyle = headGradient;
        context.beginPath();
        context.arc(head.x, head.y, this.radius * 1.2, 0, Math.PI * 2);
        context.fill();

        // Eyes
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(head.x + this.radius * 0.5, head.y - this.radius * 0.3, this.radius * 0.25, 0, Math.PI * 2);
        context.arc(head.x + this.radius * 0.5, head.y + this.radius * 0.3, this.radius * 0.25, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#000';
        context.beginPath();
        context.arc(head.x + this.radius * 0.6, head.y - this.radius * 0.3, this.radius * 0.1, 0, Math.PI * 2);
        context.arc(head.x + this.radius * 0.6, head.y + this.radius * 0.3, this.radius * 0.1, 0, Math.PI * 2);
        context.fill();


        this._drawHpBar(context, this.radius * 2, 3, -this.radius - 8);
        context.restore();
    }
}
// --- END RE-INTRODUCED BASE ENEMY CLASS ---

class DefaultSnake extends Enemy {
     constructor(x, y, waveFactor) {
        super(x, y, 10, waveFactor);
        // Health and Damage set in base Enemy constructor
        this.speed = 2.0 + (waveFactor - 1) * 0.3; // INCREASED Speed Scaling: was * 0.1
        // XP is base scaled (5 + 3 * (W-1))
        this.color = currentPalette.defaultSnake;
        this.strokeColor = this.color.slice(0, 5) + '00'; // Darken base color
     }
}

class FastSnake extends Enemy {
    constructor(x, y, waveFactor) {
        super(x, y, 8, waveFactor);
        // Health and Damage scale from base Enemy constructor
        this.speed = 4.5; // Remains fast and constant
        this.maxHp = Math.floor(this.maxHp * 0.4); // Naturally lower HP than default
        this.currentHp = this.maxHp;
        this.damage = Math.floor(this.damage * 0.6); // Lower base damage
        this.xpValue = Math.floor(this.xpValue * 1.5); // 50% XP Bonus due to high speed/risk
        this.color = currentPalette.fastSnake; // Dynamic color
        this.strokeColor = this.color.slice(0, 5) + '00';
    }
}

class TankSnake extends Enemy {
    constructor(x, y, waveFactor) {
        super(x, y, 20, waveFactor);
        this.speed = 0.8 + (waveFactor - 1) * 0.05; // Subtle speed scaling
        // Scale HP and Damage much higher than base Enemy
        this.maxHp = Math.floor(this.maxHp * 3.5);
        this.currentHp = this.maxHp;
        this.damage = Math.floor(this.damage * 2.5);
        this.xpValue = Math.floor(this.xpValue * 3.0); // 3x XP Bonus due to high durability
        this.color = currentPalette.tankSnake; // Dynamic color
        this.strokeColor = this.color.slice(0, 5) + '00';
    }
}

// NEW Enemy: Detonator Snake (Replaces Warlock)
class DetonatorSnake extends Enemy {
    constructor(x, y, waveFactor) {
        super(x, y, 15, waveFactor);
        this.speed = 3.5 + (waveFactor - 1) * 0.1; // Subtle speed scaling
        this.maxHp = Math.floor(this.maxHp * 0.7); // Moderate HP
        this.currentHp = this.maxHp;
        this.damage = 0; // Does not deal collision damage (only explosion)
        this.xpValue = Math.floor(this.xpValue * 2.0); // 2x XP Bonus due to high risk
        this.color = currentPalette.detonatorSnake; // Dynamic Detonator color
        this.strokeColor = '#ff4500'; // Red

        this.detonationRange = 40;
        this.fuseTime = 1500; // 1.5 seconds
        this.isFusing = false;
        this.fuseStart = 0;
        // Explosion damage scales aggressively
        this.explosionDamage = 30 + (waveFactor - 1) * 15;
        this.explosionRadius = 100;
    }

    update(game, player, deltaTime) {
        let actualSpeed = this.speed;
        const SLOW_FACTOR = 0.5; // 50% slow

        if (this.isSlowed) {
            actualSpeed *= SLOW_FACTOR;
        }

        const totalSpeed = actualSpeed * (deltaTime / 16.66);
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.hypot(dx, dy);
        const currentTime = Date.now();

        if (this.isFusing) {
            // Stop movement while fusing
            if (currentTime - this.fuseStart >= this.fuseTime) {
                // DETONATE!
                if (game) game.detonate(this.x, this.y, this.explosionDamage, this.explosionRadius);
                this.currentHp = 0; // Ensures removal from game loop
            }
            return;
        }

        // --- OBSTACLE COLLISION CHECK for Detonator Movement ---
        let hitObstacle = false;
        let obstacleHit = null;
        if (distance > 0 && game && game.obstacles) {
            game.obstacles.forEach(o => {
                const nextX = this.x + (dx / distance) * totalSpeed;
                const nextY = this.y + (dy / distance) * totalSpeed;
                const dist = Math.hypot(nextX - o.x, nextY - o.y);
                if (dist < this.radius + o.radius) {
                    hitObstacle = true;
                    obstacleHit = o;
                }
            });
        }

        if (hitObstacle) {
            // If blocked by obstacle, initiate fuse immediately
            this.isFusing = true;
            this.fuseStart = currentTime;
            return;
        }
        // --- END OBSTACLE CHECK ---

        if (distance <= this.detonationRange + player.radius) {
            // Initiate fuse
            this.isFusing = true;
            this.fuseStart = currentTime;
            return;
        }

        if (distance > 0) {
            this.x += (dx / distance) * totalSpeed;
            this.y += (dy / distance) * totalSpeed;
        }
    }

    draw(context) {
        const originalColor = this.color;
        if (this.isFusing) {
            // Flash rapidly between red and yellow
            this.color = (Math.floor(Date.now() / 75) % 2 === 0) ? '#ff4500' : '#ffc700';
        }

        // Call the new, improved drawing logic from the parent class
        // It will use the temporarily modified `this.color`
        super.draw(context);

        this.color = originalColor; // Reset color so it doesn't stick

        // Draw the fuse timer text on top
        if (this.isFusing) {
            context.save();
            context.translate(this.x, this.y);
            const remaining = ((this.fuseTime - (Date.now() - this.fuseStart)) / 1000).toFixed(1);
            context.fillStyle = '#fff';
            context.font = 'bold 12px Inter';
            context.textAlign = 'center';
            context.shadowColor = 'black';
            context.shadowBlur = 3;
            context.fillText(remaining, 0, -this.radius - 15);
            context.restore();
        }
    }
}


class Boss extends Enemy {
    constructor(x, y, wave) {
        super(x, y, 40, wave);

        this.speed = 1.5;
        const bossMultiplier = wave / 10;

        // --- BOSS HP INCREASE: 10x HP (5000 * multiplier) ---
        this.maxHp = Math.floor(5000 * bossMultiplier);
        this.currentHp = this.maxHp;
        // --- END BOSS HP INCREASE ---

        this.damage = Math.floor(10 * bossMultiplier) * 0.5;
        this.xpValue = Math.floor(200 * bossMultiplier);
        this.color = currentPalette.boss; // Dynamic Boss color
        this.strokeColor = currentPalette.arenaBorder;
    }

    update(game, player, deltaTime) {
        let actualSpeed = this.speed;
        const SLOW_FACTOR = 0.5;

        if (this.isSlowed) {
            actualSpeed *= SLOW_FACTOR;
        }

        const totalSpeed = actualSpeed * (deltaTime / 16.66);

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.hypot(dx, dy);

        // --- OBSTACLE COLLISION CHECK for Boss Movement ---
        let obstacleHit = null; // Changed from boolean to object holder
        if (distance > 0 && game && game.obstacles) {
            game.obstacles.forEach(o => {
                if (obstacleHit) return; // Already found one, no need to check more
                const nextX = this.x + (dx / distance) * totalSpeed;
                const nextY = this.y + (dy / distance) * totalSpeed;
                const dist = Math.hypot(nextX - o.x, nextY - o.y);
                if (dist < this.radius + o.radius) {
                    obstacleHit = o; // Store the obstacle object
                }
            });
        }

        if (obstacleHit) { // Check if an object was stored
            // Boss is deterred by obstacles, but keeps moving toward player
            // Try to move around the obstacle instead of stopping
            const pushAngle = Math.atan2(this.x - obstacleHit.x, this.y - obstacleHit.y);
            this.x += Math.cos(pushAngle) * totalSpeed * 0.5;
            this.y += Math.sin(pushAngle) * totalSpeed * 0.5;
            return;
        }
        // --- END OBSTACLE CHECK ---

        if (distance > 0) {
            this.x += (dx / distance) * totalSpeed;
            this.y += (dy / distance) * totalSpeed;
        }
    }

    // Boss uses the default enhanced enemy draw method, but we can add its crown
    draw(context) {
        super.draw(context); // Draw the enhanced snake body first

        // Draw Crown on top
        context.save();
        context.translate(this.x, this.y);
        const headX = this.radius; // Approximate head position
        const headY = 0;

        context.fillStyle = '#fbd38d';
        context.strokeStyle = '#000';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(headX, headY - this.radius * 0.6);
        context.lineTo(headX - 10, headY - this.radius * 1.5);
        context.lineTo(headX - 5, headY - this.radius * 1.0);
        context.lineTo(headX, headY - this.radius * 1.8);
        context.lineTo(headX + 5, headY - this.radius * 1.0);
        context.lineTo(headX + 10, headY - this.radius * 1.5);
        context.closePath();
        context.fill();
        context.stroke();
        context.restore();
    }
}


class Projectile extends Entity {
    constructor(x, y, radius, color, speed, angle, damage, maxTravelDistance, isExplosive = false, currentBounces = 0, weaponKey, gravity = 0) {
        super(x, y, radius, color, speed);
        this.angle = angle;
        this.dx = Math.cos(angle) * speed;
        this.dy = Math.sin(angle) * speed;
        this.damage = damage;

        this.prevX = x;
        this.prevY = y;

        this.startX = x;
        this.startY = y;
        this.maxTravelDistance = maxTravelDistance;
        this.isExplosive = isExplosive;
        this.currentBounces = currentBounces;
        this.maxBounces = currentBounces;
        this.weaponKey = weaponKey;
        this.hitEnemies = new Set();

        this.gravity = gravity;
        this.vy = this.dy; // Vertical velocity for gravity
    }

    update(deltaTime) {
        this.prevX = this.x;
        this.prevY = this.y;

        if (this.gravity !== 0) {
            // Apply gravity
            this.vy += this.gravity * (deltaTime / 16.66);
            this.x += this.dx * (deltaTime / 16.66);
            this.y += this.vy * (deltaTime / 16.66);
        } else {
            // Standard linear movement
            this.x += this.dx * (deltaTime / 16.66);
            this.y += this.dy * (deltaTime / 16.66);
        }

        const distToCenter = Math.hypot(this.x - WORLD_CENTER_X, this.y - WORLD_CENTER_Y);
        const distanceTraveled = Math.hypot(this.x - this.startX, this.y - this.startY);

        return distToCenter > WORLD_RADIUS || distanceTraveled > this.maxTravelDistance;
    }

    // NEW: Handle bounce logic
    bounce(enemies) {
        if (this.currentBounces <= 0) return false;

        let nearest = null;
        let minDistSq = Infinity;

        // Find all enemies that are alive and not already hit by this projectile
        enemies.forEach(e => {
            // NEW: Check if the projectile has already hit this enemy
            if (!this.hitEnemies.has(e) && !e.isDead) {
                const distSq = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearest = e;
                }
            }
        });

        if (nearest) {
            // 2. Calculate new angle and velocity towards the new target
            const angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
            this.dx = Math.cos(angle) * this.speed;
            this.dy = Math.sin(angle) * this.speed;

            // 3. Consume bounce count
            this.currentBounces--;

            // 4. Reset travel distance check (so it can travel max range again)
            this.startX = this.x;
            this.startY = this.y;

            return true;
        }

        return false;
    }

    draw(context) {
        // --- SPECIALIZED DRAWING LOGIC ---
        switch (this.weaponKey) {
            case 'flamethrower':
            case 'acidSprayer':
                context.fillStyle = this.color;
                context.globalAlpha = Math.random() * 0.5 + 0.3; // flicker
                for (let i=0; i < 3; i++) {
                    const offsetX = (Math.random() - 0.5) * this.radius * 3;
                    const offsetY = (Math.random() - 0.5) * this.radius * 3;
                    const size = Math.random() * this.radius * 1.5;
                    context.beginPath();
                    context.arc(this.x + offsetX, this.y + offsetY, size, 0, Math.PI * 2);
                    context.fill();
                }
                context.globalAlpha = 1.0;
                return;

            case 'lightningRod':
                context.strokeStyle = this.color;
                context.lineWidth = this.radius * 0.5;
                context.globalAlpha = 0.8;
                context.shadowBlur = 15;
                context.shadowColor = this.color;
                context.beginPath();
                context.moveTo(this.prevX, this.prevY);
                const midX = (this.x + this.prevX) / 2 + (Math.random() - 0.5) * 10;
                const midY = (this.y + this.prevY) / 2 + (Math.random() - 0.5) * 10;
                context.quadraticCurveTo(midX, midY, this.x, this.y);
                context.stroke();
                context.shadowBlur = 0;
                context.globalAlpha = 1.0;
                return;

            case 'railgun':
                 context.strokeStyle = this.color;
                 context.lineWidth = this.radius * 0.75;
                 context.globalAlpha = 0.9;
                 context.shadowBlur = 25;
                 context.shadowColor = this.color;
                 context.beginPath();
                 context.moveTo(this.prevX, this.prevY);
                 context.lineTo(this.x, this.y);
                 context.stroke();
                 context.shadowBlur = 0;
                 context.globalAlpha = 1.0;
                 return;
        }

        // --- DEFAULT DRAWING LOGIC ---
        context.save();
        context.strokeStyle = this.color;
        context.lineWidth = this.radius * 2;
        context.lineCap = 'round';

        context.beginPath();
        context.moveTo(this.prevX, this.prevY);
        context.lineTo(this.x, this.y);
        context.stroke();
        context.restore();

        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fill();

        if (this.isExplosive) {
            context.strokeStyle = '#fff';
            context.lineWidth = 1;
            context.beginPath();
            context.arc(this.x, this.y, this.radius * 1.5, 0, Math.PI * 2);
            context.stroke();
        }

         if (this.maxBounces > 0) {
            context.strokeStyle = this.color;
            context.lineWidth = 2;
            context.beginPath();
            for(let i = 0; i < 4; i++) {
                const angle = i * Math.PI / 2;
                context.moveTo(this.x + Math.cos(angle) * this.radius * 1.5, this.y + Math.sin(angle) * this.radius * 1.5);
                context.lineTo(this.x + Math.cos(angle + Math.PI / 4) * this.radius * 0.5, this.y + Math.sin(angle + Math.PI / 4) * this.radius * 0.5);
            }
            context.closePath();
            context.stroke();
         }
    }
}

// --- SPAWN DIRECTOR (Replaces Wave System) ---
class SpawnDirector {
    constructor(game) {
        this.game = game;
        this.phases = [
            { start: 0, end: 60, spawnInterval: 800, maxEnemies: 50, types: ['default'] },
            { start: 60, end: 180, spawnInterval: 600, maxEnemies: 100, types: ['default', 'fast'] },
            { start: 180, end: 300, spawnInterval: 400, maxEnemies: 200, types: ['default', 'fast', 'tank'] },
            { start: 300, end: 600, spawnInterval: 200, maxEnemies: 400, types: ['default', 'fast', 'tank', 'detonator'] },
            { start: 600, end: 1200, spawnInterval: 100, maxEnemies: 800, types: ['default', 'fast', 'tank', 'detonator', 'ranged'] }, // Ranged not impl yet
            { start: 1200, end: 99999, spawnInterval: 50, maxEnemies: 1500, types: ['default', 'fast', 'tank', 'detonator'] }
        ];
        this.nextBossTime = 60 * 5; // First boss at 5 minutes
    }

    update(deltaTime) {
        const timeInSeconds = (Date.now() - this.game.startTime) / 1000;

        // Find current phase
        const currentPhase = this.phases.find(p => timeInSeconds >= p.start && timeInSeconds < p.end) || this.phases[this.phases.length - 1];

        this.game.enemySpawnInterval = currentPhase.spawnInterval;
        this.game.maxEnemiesThisWave = currentPhase.maxEnemies;
        this.game.allowedEnemyTypes = currentPhase.types;

        // Palette Swap every minute
        const minute = Math.floor(timeInSeconds / 60);
        if (minute > this.game.currentMinute) {
            this.game.currentMinute = minute;
            this.game.handlePaletteSwap();
        }

        // Boss Spawn Logic
        if (timeInSeconds > this.nextBossTime) {
            this.game.spawnBoss();
            this.nextBossTime += 60 * 5; // Every 5 minutes
        }
    }
}

// --- GAME LOGIC ---

class Game {
    constructor(characterKey) {
        this.player = new Rat(characterKey);
        this.MAX_PARTICLES = 300;
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.pickups = [];
        this.obstacles = []; // NEW: Obstacles Array
        this.explosions = [];
        // Continuous Logic
        this.startTime = Date.now();
        this.wave = 1; // Added for compatibility
        this.kills = 0;
        this.enemySpawnInterval = 1000;
        this.lastSpawnTime = 0;
        this.maxEnemiesThisWave = 100; // Controlled by Director
        this.allowedEnemyTypes = ['default'];
        this.currentMinute = 0;

        this.spawnDirector = new SpawnDirector(this);

        this.isPaused = false;
        this.gameOver = false;
        this.lastUpdateTime = performance.now();

        this.currentUpgradeOptions = []; // Stores the currently displayed options data
        this.currentUpgradeType = null; // 'stat' or 'weapon'

        this.bestKills = highScore; // Initialize with global high score

        this.keyState = { up: false, down: false, left: false, right: false };

        // Mouse control variables
        this.mouseTargetX = WORLD_CENTER_X; // Mouse target is now in WORLD coordinates
        this.mouseTargetY = WORLD_CENTER_Y;
        this.mouseTolerance = 10; // Distance tolerance for stopping
        this.isMouseMoving = false; // Flag to check if mouse is actively moving the Rat
        this.isMouseDown = false; // Tracks if the left mouse button is held

        // Melee Animation Variables
        this.isMeleeSwinging = false;
        this.meleeSwingTimer = 0; // Timer for the visual swing animation
        this.MELEE_SWING_DURATION = 15; // 15 frames for the visual effect
        this.meleeSwingTargetAngle = 0; // New: Angle for drawing cone
        this.meleeSwingRadius = 0;      // New: Radius for drawing cone
        this.meleeSwingArc = 0;         // New: Arc for drawing cone

        // Spatial Grid for Optimization (150px cells)
        this.spatialGrid = new SpatialGrid(WORLD_RADIUS * 2, WORLD_RADIUS * 2, 150);

        this.setupInput();
        this.setupUpgradeUIEvents(); // NEW: Setup confirm/skip buttons
        this.updateHUD();

        this.initializeGame();
    }

    initializeGame() {
        this.spawnInitialEntities();
    }

    startNewWave() {
        this.isPaused = false;
    }

    // NEW: Setup click handlers for the Confirm/Skip buttons
    setupUpgradeUIEvents() {
        confirmPurchaseButton.onclick = () => this.handleConfirmPurchase();
        skipButton.onclick = () => {
            this.resume();
        };
    }

    setupInput() {
        document.removeEventListener('keydown', this.keyListenerDown);
        document.removeEventListener('keyup', this.keyListenerUp);
        canvas.removeEventListener('mousemove', this.mouseListener);
        canvas.removeEventListener('click', this.mouseClickListener);
        canvas.removeEventListener('mousedown', this.mouseDownListener);
        canvas.removeEventListener('mouseup', this.mouseUpListener);

        this.keyListenerDown = (e) => this.handleInput(e.key, true);
        this.keyListenerUp = (e) => this.handleInput(e.key, false);
        this.mouseListener = (e) => this.handleMouseMovement(e);
        this.mouseDownListener = (e) => this.handleMouseDown(e);
        this.mouseUpListener = (e) => this.handleMouseUp(e);
        canvas.addEventListener('click', this.mouseClickListener); // Keep click listener active
        document.addEventListener('keydown', this.keyListenerDown);
        document.addEventListener('keyup', this.keyListenerUp);
        canvas.addEventListener('mousemove', this.mouseListener);
        canvas.addEventListener('mousedown', this.mouseDownListener);
        canvas.addEventListener('mouseup', this.mouseUpListener);
        // FIX: Use onclick to prevent stacking event listeners on restart
        restartButton.onclick = () => this.restart();
    }

    // NEW: Handle confirmation of multiple selected items
    handleConfirmPurchase() {
        const selectedCards = Array.from(upgradeOptionsDiv.children).filter(card => card.classList.contains('selected-item'));
        let totalCost = 0;

        selectedCards.forEach(card => {
            const optionIndex = parseInt(card.dataset.index);
            const option = this.currentUpgradeOptions[optionIndex];
            totalCost += option.cost;
        });

        if (totalCost > this.player.currency) {
            // This shouldn't happen if UI correctly disables buying when cost > currency
            // But is a failsafe.
            return;
        }

        if (selectedCards.length === 0) {
            this.resume();
            if (this.currentUpgradeType === 'weapon') {
                 this.startNewWave();
            }
            return;
        }

        this.player.currency -= totalCost;

        selectedCards.forEach(card => {
            const optionIndex = parseInt(card.dataset.index);
            const upgrade = this.currentUpgradeOptions[optionIndex];

            // Apply the upgrade using its specific tier value
            if (this.currentUpgradeType === 'stat') {
                upgrade.apply(this.player, upgrade.tier);
            } else {
                upgrade.apply(this.player);
            }


            if (this.currentUpgradeType === 'stat' && !upgrade.isFree) {
                // Only track purchased stat upgrades by KEY for price increase
                this.statUpgradePrices[upgrade.key] = (this.statUpgradePrices[upgrade.key] || 0) + 1;
            }
        });

        this.resume();
        this.updateHUD();

        // If confirming a weapon choice, start the next wave immediately
        // (No logic needed here for continuous loop, resume handles it)
    }


    // NEW: Mouse Down sets the movement flag
    handleMouseDown(e) {
        if (e.button === 0) { // Left click
            this.isMouseDown = true;
            this.isMouseMoving = true;
            // When mouse is pressed, calculate target based on canvas click
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            // Convert canvas click (viewport) to World coordinates
            this.mouseTargetX = this.player.x + (e.clientX - rect.left) * scaleX - centerX;
            this.mouseTargetY = this.player.y + (e.clientY - rect.top) * scaleY - centerY;

            // When mouse is pressed, clear keyboard state for mouse priority
            this.keyState = { up: false, down: false, left: false, right: false };
            this.updateMovementDirection();
        }
    }

    // NEW: Mouse Up clears the movement flag
    handleMouseUp(e) {
        if (e.button === 0) { // Left click
            this.isMouseDown = false;
            this.isMouseMoving = false;
            this.updateMovementDirection(); // Forces stop
        }
    }

    // Mouse Click is simplified since movement is handled by Down/Up
    handleMouseClick(e) {
         if (this.isPaused || this.gameOver) return;
         // Clicks now just set the target, Down/Up handle motion
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Convert canvas click (viewport) to World coordinates
        this.mouseTargetX = this.player.x + (e.clientX - rect.left) * scaleX - centerX;
        this.mouseTargetY = this.player.y + (e.clientY - rect.top) * scaleY - centerY;
    }

    handleMouseMovement(e) {
        if (this.isPaused || this.gameOver) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // On mouse move, update the target position (in WORLD coordinates)
        this.mouseTargetX = this.player.x + (e.clientX - rect.left) * scaleX - centerX;
        this.mouseTargetY = this.player.y + (e.clientY - rect.top) * scaleY - centerY;

        if (this.isMouseDown) {
            // Only update direction if the mouse button is down
            this.updateMovementDirection();
        }
    }

    handleInput(key, isDown) {
        if (this.isPaused || this.gameOver) return;

        switch (key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.keyState.up = isDown;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.keyState.down = isDown;
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.keyState.left = isDown;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.keyState.right = isDown;
                break;
            default:
                return;
        }

        // If any movement key is pressed, keyboard takes precedence and stops mouse movement control
        if (isDown) {
            this.isMouseDown = false;
            this.isMouseMoving = false;
        }
        this.updateMovementDirection();
    }

    updateMovementDirection() {
        const ks = this.keyState;
        let dx = 0;
        let dy = 0;
        let isKeyboardActive = false;

        // 1. Check Keyboard State
        if (ks.left || ks.right || ks.up || ks.down) {
            if (ks.left) dx -= 1;
            if (ks.right) dx += 1;
            if (ks.up) dy -= 1;
            if (ks.down) dy += 1;
            isKeyboardActive = true;
        }

        // 2. Check Joystick State (only if keyboard is not active)
        if (!isKeyboardActive && joystickState.active) {
             dx = joystickState.x;
             dy = joystickState.y;
             // Joystick provides normalized vector, so we can set directly or let fall through
             // We set isKeyboardActive to prevent Mouse logic from running
             isKeyboardActive = true;
        }

        // 3. Check Mouse State (only if keyboard/joystick is not active AND mouse button is held)
        if (!isKeyboardActive && this.isMouseDown) {
            const distToTarget = Math.hypot(this.player.x - this.mouseTargetX, this.player.y - this.mouseTargetY);

            if (distToTarget > this.mouseTolerance) {
                dx = this.mouseTargetX - this.player.x;
                dy = this.mouseTargetY - this.player.y;
            } else {
                // Stop if we are close enough to the target
                this.isMouseMoving = false; // Stop movement flag
                dx = 0;
                dy = 0;
            }
        }

        // 3. Apply final movement vector
        if (dx !== 0 || dy !== 0) {
            const length = Math.hypot(dx, dy);
            this.player.moveDirection.x = dx / length;
            this.player.moveDirection.y = dy / length;
        } else {
            this.player.moveDirection.x = 0;
            this.player.moveDirection.y = 0;
        }
    }

    // NEW CENTRALIZED DEATH LOGIC
    handleEnemyDefeat(e) {
        if (e.isDead) return; // Prevent double awarding
        e.isDead = true;

        // BOSS SPECIFIC REWARD
        if (e instanceof Boss) {
            this.pickups.push(new Chest(e.x, e.y));
            console.log(`BOSS DEFEATED! Chest Spawned.`);
        } else {
            this.pickups.push(new Gem(e.x, e.y, e.xpValue));
        }

        this.kills++;
        this.player.gainCurrency(1);

        // PARTICLE EFFECT
        this.addExplosionParticles(5, e.x, e.y, currentPalette.arenaBorder, 3);

        // --- DROP LOGIC ---
        const healthDropChance = 0.05;
        if (Math.random() < healthDropChance) {
            this.pickups.push(new HealthDrop(e.x, e.y));
        }

        const explosiveDropChance = 0.02;
        const iceDropChance = 0.015;
        const speedDropChance = 0.015;
        const bombDropChance = 0.005; // 0.5% chance

        const roll = Math.random();
        if (roll < bombDropChance) {
             this.pickups.push(new BombDrop(e.x, e.y));
        } else if (roll < (bombDropChance + explosiveDropChance)) {
             this.pickups.push(new ExplosiveBulletDrop(e.x, e.y));
        } else if (roll < (bombDropChance + explosiveDropChance + iceDropChance)) {
             this.pickups.push(new IcePowerupDrop(e.x, e.y));
        } else if (roll < (bombDropChance + explosiveDropChance + iceDropChance + speedDropChance)) {
             this.pickups.push(new SpeedPowerupDrop(e.x, e.y));
        }
    }

    addExplosionParticles(count, x, y, color, size) {
        for (let i = 0; i < count; i++) {
            if (this.explosions.length >= this.MAX_PARTICLES) {
                break;
            }
            this.explosions.push(new Particle(x, y, color, Math.random() * size + 1));
        }
    }

    // NEW: Handles the AoE damage when an explosive projectile hits
    applyExplosiveAoE(x, y, baseDamage) {
        const AOE_RADIUS = 50;
        const AOE_DAMAGE_PERCENT = 0.5;
        const aoeDamage = baseDamage * AOE_DAMAGE_PERCENT;

        // Visual effect: large red flash/explosion particles
        this.addExplosionParticles(10, x, y, '#ff4500', 4);

        // Check for enemies within the AoE radius
        this.enemies.forEach(e => {
            const distance = Math.hypot(x - e.x, y - e.y);
            if (distance < AOE_RADIUS + e.radius && !e.isDead) {

                // Apply damage
                e.currentHp = Math.max(0, e.currentHp - aoeDamage);

                // LIFESTEAL
                const lifestealAmount = aoeDamage * this.player.lifestealPercentage;
                this.player.heal(lifestealAmount);

                // CHECK FOR DEATH AND AWARD KILL CREDIT
                if (e.currentHp <= 0 && !e.isDead) {
                    this.handleEnemyDefeat(e);
                }
            }
        });
    }

    // NEW: Handles Detonator explosion damage (affects player and collateral enemies)
    detonate(x, y, damage, radius) {
        // ... (Player damage logic remains the same)
        const distToPlayer = Math.hypot(x - this.player.x, y - this.player.y);
        if (distToPlayer < radius + this.player.radius) {

            if (Math.random() < this.player.evasion * 0.1) {
                 // Minimal evasion success
            } else {
                let damageRemaining = damage;

                if (this.player.shield > 0) {
                    const absorbed = Math.min(this.player.shield, damageRemaining);
                    this.player.shield -= absorbed;
                    damageRemaining -= absorbed;
                }

                let damageTaken = damageRemaining - this.player.armor;
                damageTaken = Math.max(1, damageTaken);

                this.player.currentHp -= damageTaken;
                this.player.damageFlashTimer = 10;

                if (this.player.currentHp <= 0) {
                    this.endGame();
                }
            }
        }

        // Apply damage to nearby enemies (collateral)
        const COLLATERAL_DAMAGE_PERCENT = 0.5;
        const collateralDamage = damage * COLLATERAL_DAMAGE_PERCENT;

        this.enemies.forEach(e => {
            const distance = Math.hypot(x - e.x, y - e.y);
            if (distance < radius + e.radius && !e.isDead) {

                e.currentHp = Math.max(0, e.currentHp - collateralDamage);

                // LIFESTEAL
                const lifestealAmount = collateralDamage * this.player.lifestealPercentage;
                this.player.heal(lifestealAmount);

                // CHECK FOR DEATH AND AWARD KILL CREDIT
                if (e.currentHp <= 0 && !e.isDead) {
                    this.handleEnemyDefeat(e);
                }
            }
        });

        // Create explosion particles
        this.addExplosionParticles(15, x, y, '#ff4500', 6);
    }

    // NEW: Handles the map-wide bomb explosion (triggered by BombDrop pickup)
    applyNuclearBomb() {
        // ... (Visual effect logic remains the same)
        this.addExplosionParticles(50, centerX, centerY, '#ffc700', 8);

        const EXPLOSION_DAMAGE = 200;

        // Apply MASSIVE damage to all enemies
        this.enemies.forEach(e => {
            if (e.isDead) return;

            const damage = e instanceof Boss ? EXPLOSION_DAMAGE * 0.5 : EXPLOSION_DAMAGE;
            e.currentHp = Math.max(0, e.currentHp - damage);

            // LIFESTEAL
            const lifestealAmount = damage * this.player.lifestealPercentage;
            this.player.heal(lifestealAmount);

            // Massive knockback away from center
            const angle = Math.atan2(e.y - WORLD_CENTER_Y, e.x - WORLD_CENTER_X);
            e.x += Math.cos(angle) * 100;
            e.y += Math.sin(angle) * 100;

            // CHECK FOR DEATH AND AWARD KILL CREDIT
            if (e.currentHp <= 0 && !e.isDead) {
                this.handleEnemyDefeat(e);
            }
        });
    }


    meleeAttack(x, y, weapon) {
        this.isMeleeSwinging = true;
        this.meleeSwingTimer = this.MELEE_SWING_DURATION;

        let targetAngle = 0;

        if (weapon.forcedAngle !== undefined) {
            targetAngle = weapon.forcedAngle;
        } else {
            // Default Auto-Aim for melee
            const nearestEnemy = this.getNearestEnemy(x, y);
            if (nearestEnemy) {
                targetAngle = Math.atan2(nearestEnemy.y - y, nearestEnemy.x - x);
            } else {
                targetAngle = this.player.facingRight ? 0 : Math.PI;
            }
        }

        // Store the parameters for the draw() function to create the visual slash
        this.meleeSwingTargetAngle = targetAngle;
        this.meleeSwingRadius = weapon.radius;
        this.meleeSwingArc = weapon.arcAngle;
        // --- END FIX ---

        const damage = (weapon.damage * weapon.stackDamageFactor) * this.player.damageMultiplier;
        const knockback = weapon.knockback || 0;

        this.enemies.forEach(e => {
            const distance = Math.hypot(x - e.x, y - e.y);
            if (distance < weapon.radius + e.radius) {
                const enemyAngle = Math.atan2(e.y - y, e.x - x);

                let angleDifference = enemyAngle - targetAngle; // Use the calculated targetAngle
                angleDifference = (angleDifference + Math.PI) % (Math.PI * 2) - Math.PI;
                if (angleDifference < -Math.PI) angleDifference += Math.PI * 2;

                if (Math.abs(angleDifference) <= weapon.arcAngle / 2 && !e.isDead) {

                    e.currentHp = Math.max(0, e.currentHp - damage);
                    this.player.damageFlashTimer = 5;

                    // LIFESTEAL
                    const lifestealAmount = damage * this.player.lifestealPercentage;
                    this.player.heal(lifestealAmount);


                    if (knockback > 0) {
                        // ... (Knockback logic remains the same)
                        const angle = Math.atan2(e.y - y, e.x - x);
                        const KB_FACTOR = 1.5;
                        e.x += Math.cos(angle) * knockback * KB_FACTOR;
                        e.y += Math.sin(angle) * knockback * KB_FACTOR;

                        const distToCenter = Math.hypot(e.x - WORLD_CENTER_X, e.y - WORLD_CENTER_Y);
                        if (distToCenter + e.radius > WORLD_RADIUS) {
                            const clampAngle = Math.atan2(e.y - WORLD_CENTER_Y, e.x - WORLD_CENTER_X);
                            e.x = WORLD_CENTER_X + Math.cos(clampAngle) * (WORLD_RADIUS - e.radius);
                            e.y = WORLD_CENTER_Y + Math.sin(clampAngle) * (WORLD_RADIUS - e.radius);
                        }
                    }

                    // CHECK FOR DEATH AND AWARD KILL CREDIT
                    if (e.currentHp <= 0 && !e.isDead) {
                        this.handleEnemyDefeat(e);
                    }
                }
            }
        });
    }

    spawnInitialEntities() {
        // --- NEW: Add initial scattered pickups and obstacles to the map ---
        const NUM_HEALTH_DROPS = 5;
        const NUM_ICE_DROPS = 2;
        const NUM_SPEED_DROPS = 2;
        // Scale number of obstacles with wave
        const NUM_OBSTACLES = 5 + Math.floor(this.wave / 5) * 3;

        // Add Obstacles first (Obstacle creation is self-aware of its radius)
        for (let i = 0; i < NUM_OBSTACLES; i++) {
            // Random radius between 30 and 60
            const radius = Math.random() * 30 + 30;
            const pos = this.findSafeWorldPlacement(radius + 50); // Ensure obstacle spawns away from rat center AND existing obstacles
            this.obstacles.push(new Obstacle(pos.x, pos.y, radius));
        }

        // Add Pickups (Pickups now rely on a safe spot, avoiding obstacles)
        for (let i = 0; i < NUM_HEALTH_DROPS; i++) {
            const pos = this.findSafeWorldPlacement(10);
            this.pickups.push(new HealthDrop(pos.x, pos.y));
        }
        for (let i = 0; i < NUM_ICE_DROPS; i++) {
            const pos = this.findSafeWorldPlacement(10);
            this.pickups.push(new IcePowerupDrop(pos.x, pos.y));
        }
         for (let i = 0; i < NUM_SPEED_DROPS; i++) {
            const pos = this.findSafeWorldPlacement(10);
            this.pickups.push(new SpeedPowerupDrop(pos.x, pos.y));
        }
        // --- END NEW PICKUPS AND OBSTACLES ---
    }

    handlePaletteSwap() {
        // --- NEW PALETTE SWAP LOGIC ---
        // Cycle palettes based on minutes passed
        if (this.currentMinute > 0) {
            const paletteKeys = Object.keys(COLOR_PALETTES);
            const newPaletteIndex = this.currentMinute % paletteKeys.length;
            currentPalette = COLOR_PALETTES[paletteKeys[newPaletteIndex]];
            console.log(`PALETTE SWAP: Entering ${currentPalette.name} at Minute ${this.currentMinute}`);

            // Clear sprite cache on palette swap to regenerate with new colors
            spriteCache.clear();
        }
        // --- END NEW PALETTE SWAP LOGIC ---
    }

    spawnBoss() {
        const BOSS_RADIUS = 40;
        const angle = Math.random() * Math.PI * 2;

        // Boss spawns off-screen near the edge of the world
        const spawnDist = WORLD_RADIUS - BOSS_RADIUS - 10;
        const spawnX = WORLD_CENTER_X + Math.cos(angle) * spawnDist;
        const spawnY = WORLD_CENTER_Y + Math.sin(angle) * spawnDist;

        // Calculate scaling based on minutes
        const minutes = this.currentMinute + 1;
        const boss = new Boss(spawnX, spawnY, minutes * 10); // Pass "wave" equivalent

        this.enemies.push(boss);
        this.spatialGrid.insert(boss);

        console.log(`BOSS SPAWNED! Time: ${minutes}m`);
    }


    findSafeWorldPlacement(radius) {
        let x, y;
        let attempts = 0;

        do {
            // Spawn anywhere within the world bounds
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (WORLD_RADIUS - radius);
            x = WORLD_CENTER_X + Math.cos(angle) * distance;
            y = WORLD_CENTER_Y + Math.sin(angle) * distance;

            attempts++;

            // Simple check: don't spawn right on top of the player
            const distToPlayer = Math.hypot(x - this.player.x, y - this.player.y);

            // If it's a safe distance away (e.g., more than half the viewport away)
            if (distToPlayer > VIEWPORT_RADIUS / 2) {

                // Check for overlap with existing OBSTACLES before placing a pickup/new obstacle
                let overlaps = false;
                for(const o of this.obstacles) {
                    const dist = Math.hypot(x - o.x, y - o.y);
                    if (dist < radius + o.radius + 10) { // +10 for buffer
                        overlaps = true;
                        break;
                    }
                }
                if (!overlaps) {
                    return { x, y };
                }
            }
        } while (attempts < 50); // Prevent infinite loop

        // Fallback: spawn near world center
        return { x: WORLD_CENTER_X, y: WORLD_CENTER_Y };
    }

    spawnEnemy() {
        if (this.enemies.length >= this.maxEnemiesThisWave) return;

        const SPAWN_DISTANCE = VIEWPORT_RADIUS + 50;

        let spawnX, spawnY;
        let attempts = 0;

        do {
            const angle = Math.random() * Math.PI * 2;
            spawnX = this.player.x + Math.cos(angle) * SPAWN_DISTANCE;
            spawnY = this.player.y + Math.sin(angle) * SPAWN_DISTANCE;
            attempts++;

            const distToWorldCenter = Math.hypot(spawnX - WORLD_CENTER_X, spawnY - WORLD_CENTER_Y);
            if (distToWorldCenter > WORLD_RADIUS - 10) {
                const angleFromCenter = Math.atan2(spawnY - WORLD_CENTER_Y, spawnX - WORLD_CENTER_X);
                spawnX = WORLD_CENTER_X + Math.cos(angleFromCenter) * (WORLD_RADIUS - 10);
                spawnY = WORLD_CENTER_Y + Math.sin(angleFromCenter) * (WORLD_RADIUS - 10);
                break;
            }
            if (Math.hypot(spawnX - this.player.x, spawnY - this.player.y) >= VIEWPORT_RADIUS) {
                break;
            }
        } while (attempts < 10);

        if (attempts === 10) return;

        let enemy;
        const allowed = this.allowedEnemyTypes || ['default'];
        const type = allowed[Math.floor(Math.random() * allowed.length)];
        const waveFactor = this.currentMinute + 1;

        if (type === 'tank') enemy = new TankSnake(spawnX, spawnY, waveFactor);
        else if (type === 'fast') enemy = new FastSnake(spawnX, spawnY, waveFactor);
        else if (type === 'detonator') enemy = new DetonatorSnake(spawnX, spawnY, waveFactor);
        else enemy = new DefaultSnake(spawnX, spawnY, waveFactor);

        this.enemies.push(enemy);
        this.spatialGrid.insert(enemy); // Optimization
    }


    checkCollisions() {

        this.projectiles = this.projectiles.filter(p => {
            let hit = false;

            // Retrieve nearby entities from grid
            const potentialTargets = this.spatialGrid.retrieve(p);

            // 1. Check Projectile vs. Obstacle Collision
            let hitObstacle = false;
            for (const o of potentialTargets) {
                if (o instanceof Obstacle) {
                    const dist = Math.hypot(p.x - o.x, p.y - o.y);
                    if (dist < p.radius + o.radius) {
                        hitObstacle = true;
                        break;
                    }
                }
            }

            if (hitObstacle) {
                // Projectile is immediately destroyed by obstacle
                this.addExplosionParticles(3, p.x, p.y, '#606060', 2);
                return false;
            }


            // 2. Check Projectile vs. Enemy Collision for Chaining
            for (const e of potentialTargets) {
                if (!(e instanceof Enemy)) continue; // Skip non-enemies
                if (e.isDead) continue; // Skip dead enemies

                const distance = Math.hypot(p.x - e.x, p.y - e.y);

                // Check if in range AND this projectile hasn't hit this enemy before
                if (distance < p.radius + e.radius && !p.hitEnemies.has(e)) {

                    // 1. Mark this enemy as hit by this specific projectile
                    p.hitEnemies.add(e);

                    // 2. Apply damage and on-hit effects
                    e.currentHp = Math.max(0, e.currentHp - p.damage);

                    const lifestealAmount = p.damage * this.player.lifestealPercentage;
                    this.player.heal(lifestealAmount);

                    if (p.isExplosive) {
                        this.applyExplosiveAoE(p.x, p.y, p.damage);
                    }

                    if (e.currentHp <= 0 && !e.isDead) {
                        this.handleEnemyDefeat(e);
                    }

                    // 3. Attempt to bounce (chain) to a new target (using ALL enemies for bounce search, not just local)
                    // Note: Bounce search might be expensive if searching all enemies.
                    // Optimization: Use spatial grid for bounce search too?
                    // For now, pass 'this.enemies' as before to ensure correct behavior,
                    // but could pass 'potentialTargets' if bounce range is small.
                    // Let's stick to global search for bounce reliability for now.
                    const bounced = p.bounce(this.enemies);

                    // 4. If it can't bounce anymore, the projectile is destroyed
                    if (!bounced) {
                        hit = true; // Mark for removal from the game
                    }

                    // 5. A projectile can only hit one new enemy per frame to create the chain effect
                    break;
                }
            }

            // Projectile removed if 'hit' is true (and it couldn't bounce) OR it's out of bounds.
            return !(hit || p.update(16.66));
        });

        this.enemyProjectiles = this.enemyProjectiles.filter(p => {
            const distance = Math.hypot(p.x - this.player.x, p.y - this.player.y);
            if (distance < p.radius + this.player.radius) {
                if (Math.random() < this.player.evasion) {
                    return false;
                }

                let damageRemaining = p.damage;

                if (this.player.shield > 0) {
                    const absorbed = Math.min(this.player.shield, damageRemaining);
                    this.player.shield -= absorbed;
                    damageRemaining -= absorbed;
                }

                let damageTaken = damageRemaining - this.player.armor;
                damageTaken = Math.max(1, damageTaken);

                this.player.currentHp -= damageTaken;
                this.player.damageFlashTimer = 10;

                if (this.player.currentHp <= 0) {
                    this.endGame();
                }
                return false;
            }
            return true;
        });

        // --- PLAYER COLLISION LOGIC ---

        // 1. Player vs. Enemy Collision (Damage and Knockback)
        this.enemies.forEach((e) => {
            const distance = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if (distance < e.radius + this.player.radius) {

                if (e.damage > 0) {
                    if (Math.random() < this.player.evasion) {
                        return;
                    }

                    let damageRemaining = e.damage;

                    if (this.player.shield > 0) {
                        const absorbed = Math.min(this.player.shield, damageRemaining);
                        this.player.shield -= absorbed;
                        damageRemaining -= absorbed;
                    }

                    let damageTaken = damageRemaining - this.player.armor;
                    damageTaken = Math.max(1, damageTaken);

                    this.player.currentHp -= damageTaken;
                    this.player.damageFlashTimer = 10;

                    if (this.player.currentHp <= 0) {
                        this.endGame();
                        return;
                    }
                }

                const BOUNCE_DISTANCE = 20;
                const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);

                e.x += Math.cos(angle) * BOUNCE_DISTANCE;
                e.y += Math.sin(angle) * BOUNCE_DISTANCE;

                const distToCenter = Math.hypot(e.x - WORLD_CENTER_X, e.y - WORLD_CENTER_Y);
                if (distToCenter + e.radius > WORLD_RADIUS) {
                    const clampAngle = Math.atan2(e.y - WORLD_CENTER_Y, e.x - WORLD_CENTER_X);
                    e.x = WORLD_CENTER_X + Math.cos(clampAngle) * (WORLD_RADIUS - e.radius);
                    e.y = WORLD_CENTER_Y + Math.sin(clampAngle) * (WORLD_RADIUS - e.radius);
                }
            }
        });

        // 2. Player vs. Obstacle Collision (Movement Blocking)
        this.obstacles.forEach(o => {
            const dist = Math.hypot(this.player.x - o.x, this.player.y - o.y);
            if (dist < this.player.radius + o.radius) {
                const angle = Math.atan2(this.player.y - o.y, this.player.x - o.x);
                const overlap = (this.player.radius + o.radius) - dist;
                this.player.x += Math.cos(angle) * overlap;
                this.player.y += Math.sin(angle) * overlap;

                const distToCenter = Math.hypot(this.player.x - WORLD_CENTER_X, this.player.y - WORLD_CENTER_Y);
                if (distToCenter + this.player.radius > WORLD_RADIUS) {
                    const clampAngle = Math.atan2(this.player.y - WORLD_CENTER_Y, this.player.x - WORLD_CENTER_X);
                    this.player.x = WORLD_CENTER_X + Math.cos(clampAngle) * (WORLD_RADIUS - this.player.radius);
                    this.player.y = WORLD_CENTER_Y + Math.sin(clampAngle) * (WORLD_RADIUS - this.player.radius);
                }
            }
        });

        // 3. Player vs. Pickup Collision
        this.pickups = this.pickups.filter(p => {
            let pickupRadius = this.player.radius;

            // Magnet logic for Gems
            if (p instanceof Gem) {
                const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
                if (dist < this.player.magnetRange) {
                    const angle = Math.atan2(this.player.y - p.y, this.player.x - p.x);
                    p.x += Math.cos(angle) * 8; // Fly to player
                    p.y += Math.sin(angle) * 8;
                }
            }

            const distance = Math.hypot(p.x - this.player.x, p.y - this.player.y);
            if (distance < p.radius + pickupRadius) {

                if (p instanceof HealthDrop) {
                    this.player.heal(p.healAmount);
                } else if (p instanceof Gem) {
                    this.player.gainXp(p.value, this);
                } else if (p instanceof Chest) {
                    this.openChest();
                } else if (p instanceof ExplosiveBulletDrop) {
                     this.player.applyExplosiveBuff(p.buffDuration);
                } else if (p instanceof IcePowerupDrop) {
                     this.player.applyIceAura(p.buffDuration, this);
                } else if (p instanceof SpeedPowerupDrop) {
                     this.player.applyExtremeSpeed(p.buffDuration);
                } else if (p instanceof BombDrop) { // NEW BOMB PICKUP
                     this.applyNuclearBomb();
                }

                return false;
            }
            return true;
        });
    }

    getNearestEnemy(x, y) {
        let nearest = null;
        let minDistSq = Infinity;

        this.enemies.forEach(e => {
            const distSq = (e.x - x) ** 2 + (e.y - y) ** 2;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearest = e;
            }
        });
        return nearest;
    }

    // New method to get N nearest enemies
    getNNearestEnemies(n) {
        return this.enemies
            .map(e => ({ e, distance: Math.hypot(e.x - this.player.x, e.y - this.player.y) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, n)
            .map(item => item.e);
    }

    generateLevelUpOptions() {
        const options = [];

        // 1. WEAPON CANDIDATES
        const hasWeaponSlot = this.player.weapons.length < this.player.maxWeapons;

        Object.values(WEAPONS).forEach(w => {
            const existing = this.player.weapons.find(pw => pw.key === w.key);

            if (existing) {
                // Upgrade (only if not maxed and not evolved)
                if (existing.level < 8 && !existing.evolved) {
                    const nextStats = w.levels[existing.level]; // level is 1-based, array is 0-based. next level is at index 'level'
                    // Wait, existing.level=1 means index 0 is current. Index 1 is next.
                    // But array size is 8. Index 7 is Level 8.
                    // If level < 8, we can upgrade.

                    options.push({
                        type: 'weapon',
                        key: w.key,
                        name: w.name,
                        description: `Upgrade to Level ${existing.level + 1}.`, // Simplified desc
                        emoji: w.emoji,
                        apply: (p) => p.addWeapon(w.key)
                    });
                }
            } else if (hasWeaponSlot) {
                // New
                options.push({
                    type: 'weapon',
                    key: w.key,
                    name: `NEW! ${w.name}`,
                    description: w.description,
                    emoji: w.emoji,
                    apply: (p) => p.addWeapon(w.key)
                });
            }
        });

        // 2. PASSIVE CANDIDATES
        const equippedPassiveKeys = this.player.passives.map(p => p.key);
        const hasPassiveSlot = this.player.passives.length < this.player.maxPassives;

        Object.values(PASSIVE_ITEMS).forEach(p => {
            const equipped = this.player.passives.find(ep => ep.key === p.key);
            const level = equipped ? equipped.level : 0;

            if (level > 0 && level < p.maxLevel) {
                // Upgrade
                options.push({
                    type: 'passive',
                    key: p.key,
                    name: p.name,
                    description: `Upgrade to Level ${level + 1}. ${p.description}`,
                    emoji: p.emoji,
                    apply: (rat) => rat.addPassive(p.key)
                });
            } else if (level === 0 && hasPassiveSlot) {
                // New
                options.push({
                    type: 'passive',
                    key: p.key,
                    name: `NEW! ${p.name}`,
                    description: p.description,
                    emoji: p.emoji,
                    apply: (rat) => rat.addPassive(p.key)
                });
            }
        });

        // 3. FALLBACK: HEAL or GOLD
        if (options.length === 0) {
            options.push({
                type: 'consumable',
                name: "Floor Chicken",
                description: "Heal 50 HP",
                emoji: "🍗",
                apply: (rat) => rat.heal(50)
            });
            options.push({
                type: 'consumable',
                name: "Bag of Gold",
                description: "Gain 50 Currency",
                emoji: "💰",
                apply: (rat) => rat.gainCurrency(50)
            });
        }

        // Shuffle and pick 3 (or 4 if luck is high? Future feature)
        return options.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    showLevelUpScreen() {
        this.player.moveDirection = { x: 0, y: 0 };
        this.keyState = { up: false, down: false, left: false, right: false };
        this.isMouseMoving = false;
        this.isMouseDown = false;

        this.isPaused = true;
        upgradeScreen.classList.remove('hidden');
        upgradeOptionsDiv.innerHTML = '';
        upgradeScreenTitle.textContent = "LEVEL UP!";

        // Hide summary since everything is free now
        purchaseSummary.style.display = 'none';
        confirmPurchaseButton.classList.add('hidden'); // Hide until selection

        this.currentUpgradeOptions = this.generateLevelUpOptions();

        this.currentUpgradeOptions.forEach((option, index) => {
            const card = document.createElement('div');
            const borderColor = option.type === 'weapon' ? 'border-red-500' : (option.type === 'passive' ? 'border-blue-500' : 'border-green-500');
            const textColor = option.type === 'weapon' ? 'text-red-300' : (option.type === 'passive' ? 'text-blue-300' : 'text-green-300');

            card.className = `upgrade-card p-4 rounded-lg border-4 ${borderColor} cursor-pointer hover:bg-gray-800 transition`;
            card.dataset.index = index;

            card.innerHTML = `
                <div class="text-4xl mb-2">${option.emoji}</div>
                <h3 class="text-xl font-bold ${textColor} mb-1">${option.name}</h3>
                <p class="text-sm text-gray-300">${option.description}</p>
            `;

            card.onclick = () => this.handleCardSelection(card, option);
            upgradeOptionsDiv.appendChild(card);
        });
    }

    handleCardSelection(card, option) {
        // Deselect others
        Array.from(upgradeOptionsDiv.children).forEach(c => c.classList.remove('bg-gray-700', 'border-white'));

        // Select clicked
        card.classList.add('bg-gray-700', 'border-white'); // Highlight

        // Show/Enable Confirm Button
        confirmPurchaseButton.classList.remove('hidden');
        confirmPurchaseButton.onclick = () => this.handleConfirmPurchase(option);
    }

    handleConfirmPurchase(option) {
        if (!option) return;

        option.apply(this.player);

        this.resume();
    }

    openChest() {
        this.isPaused = true;
        upgradeScreen.classList.remove('hidden');
        upgradeOptionsDiv.innerHTML = '';
        upgradeScreenTitle.textContent = "TREASURE CHEST!";
        purchaseSummary.style.display = 'none';
        skipButton.classList.add('hidden');
        confirmPurchaseButton.classList.remove('hidden');
        confirmPurchaseButton.textContent = "CLAIM REWARDS";
        confirmPurchaseButton.onclick = () => {
            skipButton.classList.remove('hidden'); // Reset for next time
            this.resume();
        };

        // 1. CHECK EVOLUTIONS
        const evolvableWeapon = this.player.weapons.find(w => {
            if (w.evolved || w.level < 8) return false;
            const def = WEAPONS[w.key];
            if (!def || !def.evolvesTo) return false;
            const hasPassive = this.player.passives.some(p => p.key === def.requiredPassive);
            return hasPassive;
        });

        if (evolvableWeapon) {
            const def = WEAPONS[evolvableWeapon.key];
            const evolvedKey = def.evolvesTo;
            const evolvedDef = EVOLVED_WEAPONS[evolvedKey];

            // Evolve it!
            evolvableWeapon.evolved = true;
            evolvableWeapon.key = evolvedKey; // Change key to evolved version
            this.player.updateWeaponStats(evolvableWeapon, evolvedDef);

            // Visuals
            upgradeScreenTitle.textContent = "EVOLUTION!";
            const card = document.createElement('div');
            card.className = `upgrade-card p-6 rounded-lg border-4 border-purple-500 bg-gray-800 transform scale-110 shadow-[0_0_20px_rgba(168,85,247,0.5)]`;
            card.innerHTML = `
                <div class="text-6xl mb-4 animate-bounce text-center">${evolvedDef.emoji}</div>
                <h3 class="text-3xl font-bold text-purple-300 mb-2 text-center">${evolvedDef.name}</h3>
                <p class="text-md text-gray-300 text-center">${evolvedDef.description}</p>
            `;
            upgradeOptionsDiv.appendChild(card);
            return;
        }

        // 2. STANDARD REWARDS (Grant 3 random upgrades/gold)
        const candidates = [];

        // Weapons (Can be upgraded)
        this.player.weapons.forEach(w => {
            // Can only upgrade standard weapons that are not maxed
            if (!w.evolved && w.level < 8) {
                candidates.push({ type: 'weapon', key: w.key, name: WEAPONS[w.key].name, emoji: WEAPONS[w.key].emoji });
            }
        });
        // Passives (not maxed)
        this.player.passives.forEach(p => {
            const def = PASSIVE_ITEMS[p.key];
            if (p.level < def.maxLevel) {
                candidates.push({ type: 'passive', key: p.key, name: def.name, emoji: def.emoji });
            }
        });

        const rewards = [];
        // Limit to 3 or candidates length
        const rewardCount = 3;

        for (let i = 0; i < rewardCount; i++) {
            if (candidates.length === 0) {
                this.player.gainCurrency(100);
                rewards.push({ name: "Bag of Gold", emoji: "💰", description: "+100 Score" });
            } else {
                const pickIndex = Math.floor(Math.random() * candidates.length);
                const pick = candidates[pickIndex];

                if (pick.type === 'weapon') {
                    this.player.addWeapon(pick.key);
                    rewards.push({ name: pick.name, emoji: pick.emoji, description: "Weapon Upgraded!" });

                    // Check if now maxed
                    const w = this.player.weapons.find(wp => wp.key === pick.key);
                    if (w && w.level >= 8) candidates.splice(pickIndex, 1);

                } else {
                    this.player.addPassive(pick.key);
                    rewards.push({ name: pick.name, emoji: pick.emoji, description: "Passive Upgraded!" });

                    // Check if maxed
                    const p = this.player.passives.find(pas => pas.key === pick.key);
                    if (p && p.level >= PASSIVE_ITEMS[pick.key].maxLevel) candidates.splice(pickIndex, 1);
                }
            }
        }

        // Display Rewards
        rewards.forEach(r => {
            const card = document.createElement('div');
            card.className = `upgrade-card p-4 rounded-lg border-4 border-yellow-500 bg-gray-800`;
            card.innerHTML = `
                <div class="text-4xl mb-2">${r.emoji}</div>
                <h3 class="text-xl font-bold text-yellow-300 mb-1">${r.name}</h3>
                <p class="text-sm text-gray-300">${r.description}</p>
            `;
            upgradeOptionsDiv.appendChild(card);
        });
    }

    resume() {
        this.isPaused = false;
        upgradeScreen.classList.add('hidden');
        this.lastUpdateTime = performance.now();
        window.requestAnimationFrame(gameLoop);
    }

    endGame() {
        this.gameOver = true;
        this.isPaused = true;
        cancelAnimationFrame(animationFrameId);

        let highscoreMessage = '';

        // NEW: High Score Logic
        if (this.kills > this.bestKills) {
            this.bestKills = this.kills;
            localStorage.setItem(HIGHSCORE_KEY, this.bestKills);
            highscoreMessage = `<span class="text-yellow-400 font-bold">NEW HIGH SCORE!</span>`;
        } else {
            highscoreMessage = `Best Score: ${this.bestKills} Kills`;
        }
        // END NEW High Score Logic

        document.getElementById('messageTitle').textContent = "GAME OVER";
        document.getElementById('messageText').innerHTML = `
            You survived ${this.wave - 1} waves and earned ${this.kills} Kills.<br>
            Final Level: ${this.player.level}<br><br>
            ${highscoreMessage}
        `;
        messageBox.classList.remove('hidden');
    }

    restart() {
        document.removeEventListener('keydown', this.keyListenerDown);
        document.removeEventListener('keyup', this.keyListenerUp);
        canvas.removeEventListener('mousemove', this.mouseListener);
        canvas.removeEventListener('click', this.mouseClickListener);
        canvas.removeEventListener('mousedown', this.mouseDownListener);
        canvas.removeEventListener('mouseup', this.mouseUpListener);

        messageBox.classList.add('hidden');
        // Re-read the global high score just in case another run finished quickly
        highScore = parseInt(localStorage.getItem(HIGHSCORE_KEY) || '0', 10);
        showStartScreen();
    }

    updateHUD() {
        // --- WEAPONS ---
        const weaponHTML = this.player.weapons.map(w => {
            const def = WEAPONS[w.key] || EVOLVED_WEAPONS[w.key];
            const name = def ? def.name : w.key;
            const emoji = def ? def.emoji : '❓';
            const lvlText = w.evolved ? "EVOLVED" : `Lvl ${w.level}`;
            return `<div>${emoji} ${name} <span class="text-gray-400 text-xs ml-2">${lvlText}</span></div>`;
        }).join('');

        hud.weaponList.innerHTML = weaponHTML;
        hud.weaponSlots.textContent = `(${this.player.weapons.length}/${this.player.maxWeapons})`;

        // --- PASSIVES ---
        if (hud.passiveSlots) {
            hud.passiveSlots.innerHTML = '';
            for (let i = 0; i < this.player.maxPassives; i++) {
                const slot = document.createElement('div');
                slot.className = 'w-8 h-8 bg-gray-900/80 border border-gray-600 rounded flex items-center justify-center relative shadow-sm mt-2';

                if (i < this.player.passives.length) {
                    const p = this.player.passives[i];
                    const def = PASSIVE_ITEMS[p.key];

                    slot.innerHTML = `
                        <div class="text-lg filter drop-shadow-md cursor-default" title="${def.name}">${def.emoji}</div>
                        <div class="absolute bottom-0 right-0 bg-black/80 text-[8px] px-1 rounded-tl text-white font-bold select-none">${p.level}</div>
                    `;
                } else {
                    slot.classList.add('opacity-30');
                }
                hud.passiveSlots.appendChild(slot);
            }
        }

        // --- BUFFS & STATS ---
        let buffText = '';
        if (this.player.buffs.explosiveBullets > 0) buffText += `💥 ${Math.ceil(this.player.buffs.explosiveBullets / 1000)}s  `;
        if (this.player.buffs.iceAura > 0) buffText += `❄️ ${Math.ceil(this.player.buffs.iceAura / 1000)}s  `;
        if (this.player.buffs.extremeSpeed > 0) buffText += `💨 ${Math.ceil(this.player.buffs.extremeSpeed / 1000)}s  `;
        hud.buffTimer.textContent = buffText;

        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        hud.waveCount.textContent = `${mins}:${secs}`;

        hud.killCount.textContent = this.kills;
        hud.bestKillCount.textContent = this.bestKills;

        // NEW: Update Gold & Level
        if(hud.goldCount) hud.goldCount.textContent = this.player.currency || 0;
        if(hud.currentLevel) hud.currentLevel.textContent = this.player.level;

        // NEW: Update HP Bar
        hud.currentHP.textContent = Math.max(0, Math.floor(this.player.currentHp));
        hud.maxHP.textContent = this.player.maxHp;

        if (hud.hpBarFill) {
            const hpRatio = this.player.currentHp / this.player.maxHp;
            hud.hpBarFill.style.width = `${Math.max(0, Math.min(100, hpRatio * 100))}%`;
            hud.hpBarFill.className = `h-full transition-all duration-200 w-full ${hpRatio > 0.5 ? 'bg-green-600' : (hpRatio > 0.25 ? 'bg-yellow-500' : 'bg-red-600')}`;
        }

        // Update Stats Panel (Hidden but kept for reference)
        if(hud.statSpeed) hud.statSpeed.textContent = this.player.baseSpeed.toFixed(1);
        if(hud.statDamage) hud.statDamage.textContent = this.player.damageMultiplier.toFixed(2);
        if(hud.statArmor) hud.statArmor.textContent = this.player.armor;
        if(hud.statEvasion) hud.statEvasion.textContent = (this.player.evasion * 100).toFixed(0);
        if(hud.statProjectiles) hud.statProjectiles.textContent = this.player.projectileCountBonus;
        if(hud.statAttackSpeed) hud.statAttackSpeed.textContent = ((this.player.fireRateReduction * (this.player.buffs.extremeSpeed > 0 ? 1.5 : 1.0) - 1) * 100).toFixed(0);
        if(hud.statRange) hud.statRange.textContent = this.player.attackRangeMultiplier.toFixed(1);
        if(hud.statShield) hud.statShield.textContent = Math.floor(this.player.shield);

        const xpRatio = this.player.xp / this.player.xpToNextLevel;
        hud.xpBarFill.style.width = `${Math.min(100, xpRatio * 100)}%`;
    }

    update(deltaTime) {
        if (this.isPaused) return;

        const currentTime = Date.now();

        // Update Spawn Director
        this.spawnDirector.update(deltaTime);

        // Spawn Enemies based on interval
        if (currentTime - this.lastSpawnTime > this.enemySpawnInterval) {
            this.spawnEnemy();
            this.lastSpawnTime = currentTime;
        }

        // Update melee swing timer
        if (this.isMeleeSwinging) {
            this.meleeSwingTimer--;
            if (this.meleeSwingTimer <= 0) {
                this.isMeleeSwinging = false;
            }
        }

        this.updateMovementDirection(); // Recalculate movement based on KB/Mouse before updating position

        this.player.update(this, deltaTime);

        // --- SPATIAL GRID POPULATION ---
        this.spatialGrid.clear();
        this.obstacles.forEach(o => this.spatialGrid.insert(o));

        this.enemies.forEach(e => {
            e.update(this, this.player, deltaTime);
            if (!e.isDead) this.spatialGrid.insert(e);
        });
        // --- END SPATIAL GRID ---

        // FIX: Removed p.update(deltaTime) call for pickups as they don't have physics update logic
        // this.pickups.forEach(p => p.update(deltaTime));

        this.explosions = this.explosions.filter(p => !p.update());
        this.enemyProjectiles = this.enemyProjectiles.filter(p => !p.update(deltaTime));

        this.checkCollisions();

        // --- NEW CLEANUP FIX: Remove any enemy that died from any source (AoE, Detonator self-destruct) ---
        this.enemies = this.enemies.filter(e => !e.isDead);
        // --- END NEW CLEANUP FIX ---

        this.updateHUD();
    }

    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Set background color outside the arena (currently draws over the whole canvas)
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // --- CAMERA TRANSLATION: Shift the world so the player is centered ---
        // Calculate camera offset
        const cameraOffsetX = centerX - this.player.x;
        const cameraOffsetY = centerY - this.player.y;

        ctx.save(); // Save context state 1 (before translate)
        ctx.translate(cameraOffsetX, cameraOffsetY);

        // 2. DRAW WORLD ELEMENTS

        // Draw World Boundary (The large explorable area floor)
        ctx.beginPath();
        ctx.arc(WORLD_CENTER_X, WORLD_CENTER_Y, WORLD_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = currentPalette.arenaBase;
        ctx.fill();

        // Add subtle shadow gradient for depth
        const gradientDepth = ctx.createRadialGradient(WORLD_CENTER_X, WORLD_CENTER_Y, 0, WORLD_CENTER_X, WORLD_CENTER_Y, WORLD_RADIUS);
        gradientDepth.addColorStop(0, 'rgba(0,0,0,0.05)');
        gradientDepth.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = gradientDepth;
        ctx.beginPath();
        ctx.arc(WORLD_CENTER_X, WORLD_CENTER_Y, WORLD_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Add subtle randomized 'pebbles' for texture (dynamic color)
        ctx.fillStyle = currentPalette.arenaPebbles;
        for(let i=0; i<300; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * WORLD_RADIUS;
            const px = WORLD_CENTER_X + Math.cos(angle) * distance;
            const py = WORLD_CENTER_Y + Math.sin(angle) * distance;
            ctx.fillRect(px, py, 1, 1);
        }

        // Draw World Boundary Stroke (Outer edge of the entire game world)
        ctx.strokeStyle = currentPalette.arenaBorder;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(WORLD_CENTER_X, WORLD_CENTER_Y, WORLD_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        // 3. DRAW GAME ENTITIES
        this.obstacles.forEach(o => o.draw(ctx));
        this.pickups.forEach(p => p.draw(ctx));
        this.projectiles.forEach(p => p.draw(ctx));
        this.enemyProjectiles.forEach(p => p.draw(ctx));
        this.explosions.forEach(p => p.draw(ctx));
        this.enemies.forEach(e => e.draw(ctx));
        this.player.draw(ctx);

        // 4. Draw Melee Slash Animation (must be inside the translated/clipped context)
        if (this.isMeleeSwinging) {
            const progress = (this.MELEE_SWING_DURATION - this.meleeSwingTimer) / this.MELEE_SWING_DURATION;
            // Animate alpha to be brightest mid-swing
            const alpha = Math.sin(progress * Math.PI);

            const radius = this.meleeSwingRadius;
            const totalArc = this.meleeSwingArc;
            const centerAngle = this.meleeSwingTargetAngle;

            // Define the start of the full swing arc
            const swingStartAngle = centerAngle - totalArc / 2;

            // The current angle of the slash moves across the total arc
            const currentAngle = swingStartAngle + (totalArc * progress);

            // The slash itself is a small arc
            const slashWidth = Math.PI / 6; // How wide the swoosh is
            const slashStart = currentAngle - slashWidth / 2;
            const slashEnd = currentAngle + slashWidth / 2;

            ctx.save();
            ctx.translate(this.player.x, this.player.y);

            // White core of the slash
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.arc(0, 0, radius, slashStart, slashEnd);
            ctx.stroke();

            // Colored glow around the slash
            ctx.strokeStyle = `rgba(${parseInt(currentPalette.arenaBorder.substring(1, 3), 16)}, ${parseInt(currentPalette.arenaBorder.substring(3, 5), 16)}, ${parseInt(currentPalette.arenaBorder.substring(5, 7), 16)}, ${alpha * 0.7})`;
            ctx.lineWidth = 12;
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(${parseInt(currentPalette.arenaBorder.substring(1, 3), 16)}, ${parseInt(currentPalette.arenaBorder.substring(3, 5), 16)}, ${parseInt(currentPalette.arenaBorder.substring(5, 7), 16)}, ${alpha * 0.5})`;

            ctx.beginPath();
            ctx.arc(0, 0, radius, slashStart, slashEnd);
            ctx.stroke();

            ctx.restore();
        }

        // Restore context state 1 (removes translation)
        ctx.restore();

        // 6. Draw Mouse Target Indicator (must be in screen coordinates)
        if (this.isMouseDown) {
            // Calculate screen position of mouse target
            const screenMouseX = centerX + (this.mouseTargetX - this.player.x);
            const screenMouseY = centerY + (this.mouseTargetY - this.player.y);

            ctx.save();
            ctx.strokeStyle = currentPalette.arenaBorder;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(screenMouseX, screenMouseY, 15, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

// --- GAME LOOP ---

function gameLoop(currentTime) {
    // FIX: Ensure game object exists before accessing its properties
    if (!game) {
        window.requestAnimationFrame(gameLoop);
        return;
    }

    if (!game.isPaused) {
        let deltaTime = currentTime - game.lastUpdateTime;
        // Cap deltaTime to prevent spiral/explosions on tab switch or lag
        deltaTime = Math.min(deltaTime, 50);

        // FIX: Check if game.update is defined before calling
        if (typeof game.update === 'function') {
            game.update(deltaTime);
            game.draw();
        }
        game.lastUpdateTime = currentTime;
    }
    if (!game.gameOver) {
        animationFrameId = window.requestAnimationFrame(gameLoop);
    }
}

// --- STARTUP LOGIC ---

function startGame(characterKey) {
    startScreen.classList.add('hidden');
    // Reset palette to default on start
    currentPalette = COLOR_PALETTES.dirt;
    game = new Game(characterKey);

    // FIX: Move startNewWave() call here to ensure 'game' object is fully instantiated
    game.startNewWave();

    // Ensure lastUpdateTime is set immediately before the first frame request
    game.lastUpdateTime = performance.now();
    window.requestAnimationFrame(gameLoop);
}

function showStartScreen() {
    startScreen.classList.remove('hidden');

    // --- MODIFICATION: Updated ID to characterOptionsDiv ---
    characterOptionsDiv.innerHTML = '';

    Object.entries(CHARACTERS).forEach(([key, character]) => {
        const card = document.createElement('div');
        card.className = 'character-card p-6 rounded-lg text-left shadow-xl';
        card.innerHTML = `
            <h3 class="2xl font-bold text-blue-300 mb-2">${character.name}</h3>
            <p class="text-sm text-gray-300 mb-4">${character.description}</p>
            <hr class="border-gray-600 mb-3">
            <ul class="text-xs text-gray-400 space-y-1">
                <li>HP: <span class="text-white">${character.initialStats.maxHp}</span></li>
                <li>Damage Multiplier: <span class="text-white">${character.initialStats.damageMultiplier.toFixed(1)}x</span></li>
                <li>Max Slots: <span class="text-yellow-500 font-bold">${character.initialStats.maxWeapons}</span></li>
                <li>Armor: <span class="text-white">${character.initialStats.armor}</span></li>
                <li>Evasion: <span class="text-white">${(character.initialStats.evasion * 100).toFixed(0)}%</span></li>
                <li>Shield: <span class="text-blue-400">${character.initialStats.shield}</span></li> <li>Lifesteal: <span class="text-red-400">${(character.initialStats.lifestealPercentage * 100).toFixed(1)}%</span></li> <li class="mt-2 text-yellow-500">Starts with: ${WEAPONS[character.starterWeapon].name} ${WEAPONS[character.starterWeapon].emoji}</li>
                <li class="text-sm mt-3 text-white font-semibold">SKIN: <span style="color: ${character.ratColors.main}">${character.name.split(' ').pop()} Style</span></li>
            </ul>
        `;
        card.onclick = () => startGame(key);
        characterOptionsDiv.appendChild(card);
    });
    // --- END MODIFICATION ---

    // Initial HUD update for high score display
    hud.bestKillCount.textContent = highScore;
}


// Initialize the game
window.onload = () => {
    showStartScreen();
};