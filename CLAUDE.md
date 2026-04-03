# CLAUDE.md — NeonDrift: Online Multiplayer Racing Game

> **READ THIS FIRST.** This is the master blueprint for building a visually stunning, browser-based multiplayer racing game. Every file you create must include `/** LEARNING NOTE: ... */` blocks so the developer learns game dev concepts while building. Prioritize visual quality — this game should look like it belongs on Steam, not in a browser.

---

## 🎯 Vision & Aesthetic

**Game:** NeonDrift — A fast, drift-heavy online multiplayer racing game
**Aesthetic:** Cyberpunk night-racing. Think *Need for Speed Underground* meets *Wipeout* meets *Akira*. Wet asphalt reflecting neon, volumetric fog cutting through headlights, metallic car paint that shifts color in the light, cinematic motion blur at 200km/h.

**Art Direction Pillars:**
1. **Wet & Reflective** — Everything reflects. Roads are always slightly wet. Cars are chrome and glass.
2. **Neon & Contrast** — Deep blacks punctured by vivid neon (cyan, magenta, amber). No flat lighting ever.
3. **Speed & Danger** — Motion blur, sparks, screen distortion. The player should *feel* velocity through their eyes.
4. **Cinematic** — Camera work, depth of field, lens flares. Every frame could be a screenshot.

**The 3-Second Rule:** If someone glances at this game for 3 seconds, they should think "wait, this runs in a browser?"

---

## 🏗️ Engine & Technology

### Why Not Unity/Unreal?
Unity and Unreal compile to native executables — players would need to download a 2GB+ app. We want **zero-install multiplayer**: send a link, your friend clicks it, they're racing you in 10 seconds. That's only possible in the browser.

### Our Stack (and Why It's Powerful Enough)

| Layer | Technology | Why |
|-------|-----------|-----|
| **Renderer** | **Three.js r170+ with WebGPU backend** | WebGPU is the next-gen browser graphics API — replaces WebGL. Enables compute shaders, better draw calls, GPU-driven rendering. Three.js has experimental WebGPU support via `THREE.WebGPURenderer`. **Fall back to WebGL2 if WebGPU unavailable.** |
| **Physics** | **Rapier (via @dimforge/rapier3d-compat)** | WASM-based physics engine. 5-10x faster than cannon-es. Written in Rust, compiled to WebAssembly. Proper vehicle physics with suspension, tire friction curves. |
| **Networking** | **Socket.IO** | Rooms, reconnection, binary transport. Good enough for 2-8 players at 20Hz tick rate. |
| **UI** | **React 18 + Zustand** | Menu system, HUD overlay, lobby — rendered as HTML layer on top of the 3D canvas. |
| **Build** | **Vite 6** | Instant HMR, WASM support, tree-shaking. |
| **Language** | **TypeScript (strict)** | No `any`. Ever. Game code especially benefits from strong typing. |
| **Audio** | **Tone.js + Web Audio API** | Engine sound synthesis (no audio files for engine — generate from RPM curves). Positional 3D audio. |

### Graphics Pipeline Overview

```
┌─────────────────────────────────────────────────────────┐
│                   RENDERING PIPELINE                     │
│                                                          │
│  Scene Graph (Three.js)                                  │
│  ├── Track geometry (instanced meshes, LOD)              │
│  ├── Vehicles (custom PBR shaders, env map reflections)  │
│  ├── Particles (GPU instanced: sparks, smoke, rain)      │
│  ├── Lights (deferred-style: many neon point lights)     │
│  └── Environment (skybox, fog volumes, god rays)         │
│                                                          │
│  Post-Processing Stack (EffectComposer)                  │
│  ├── 1. SSAO (screen-space ambient occlusion)            │
│  ├── 2. SSR (screen-space reflections) ← WET ROADS       │
│  ├── 3. Bloom (HDR glow on neon + headlights)            │
│  ├── 4. Motion Blur (per-object velocity-based)          │
│  ├── 5. Chromatic Aberration (speed-reactive)            │
│  ├── 6. Film Grain (subtle, cinematic texture)           │
│  ├── 7. Color Grading (LUT-based, per-track palette)     │
│  ├── 8. Vignette (subtle edge darkening)                 │
│  └── 9. FXAA / TAA (anti-aliasing)                       │
│                                                          │
│  Final Composite → Canvas                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📐 Project Architecture

```
neon-drift/
├── client/
│   ├── src/
│   │   ├── engine/                     # Core rendering engine
│   │   │   ├── Renderer.ts                 # WebGPU/WebGL2 renderer setup, resize handling
│   │   │   ├── GameLoop.ts                 # Fixed timestep loop (physics 60Hz, render vsync)
│   │   │   ├── SceneManager.ts             # Scene graph, layer management
│   │   │   ├── AssetPipeline.ts            # GLTF/KTX2/Draco loader, texture atlas, LOD
│   │   │   └── PerformanceMonitor.ts       # FPS, draw calls, memory, GPU time
│   │   │
│   │   ├── rendering/                  # Advanced rendering systems
│   │   │   ├── PBRCarShader.ts             # Custom car paint shader (clearcoat, flake, metallic)
│   │   │   ├── RoadShader.ts               # Wet road: normal-mapped asphalt + SSR hints
│   │   │   ├── NeonMaterial.ts             # Emissive neon with bloom interaction
│   │   │   ├── PostProcessingStack.ts      # Full post-process pipeline (see diagram above)
│   │   │   ├── SSRPass.ts                  # Screen-space reflections for wet surfaces
│   │   │   ├── VolumetricFogPass.ts        # Ray-marched volumetric fog/god rays
│   │   │   ├── MotionBlurPass.ts           # Per-object velocity buffer motion blur
│   │   │   ├── ColorGradingPass.ts         # LUT-based cinematic color grading
│   │   │   ├── LensFlareSystem.ts          # Headlight / sun lens flares
│   │   │   ├── EnvironmentProbe.ts         # Real-time cubemap for car reflections
│   │   │   └── QualityPresets.ts           # Low/Medium/High/Ultra settings
│   │   │
│   │   ├── vehicles/                   # Vehicle system
│   │   │   ├── VehiclePhysics.ts           # Rapier raycast vehicle, suspension, tire model
│   │   │   ├── VehicleVisuals.ts           # GLTF model, wheel spin, suspension compression
│   │   │   ├── DriftSystem.ts              # Drift detection, boost charging, drift scoring
│   │   │   ├── VehicleEffects.ts           # Headlights, brake lights, underbody neon glow
│   │   │   ├── ExhaustFlame.ts             # Backfire flames on decel, nitro exhaust
│   │   │   └── VehicleAudio.ts             # Synthesized engine + turbo + exhaust pops
│   │   │
│   │   ├── track/                      # Track & environment
│   │   │   ├── TrackBuilder.ts             # Spline-based track generation + road mesh extrusion
│   │   │   ├── TrackColliders.ts           # Physics colliders: road, walls, barriers, rumble strips
│   │   │   ├── Checkpoints.ts              # Invisible trigger volumes, lap counting, position calc
│   │   │   ├── TrackEnvironment.ts         # Buildings, props, billboards, crowd, skyline
│   │   │   ├── DynamicWeather.ts           # Rain particles, wet road toggle, lightning flashes
│   │   │   ├── TrackLighting.ts            # Hundreds of neon point lights (instanced), spotlights
│   │   │   └── SkidMarkRenderer.ts         # Decal-based tire marks, fade over time
│   │   │
│   │   ├── particles/                  # GPU particle systems
│   │   │   ├── GPUParticleEngine.ts        # Instanced mesh particles, compute shader update
│   │   │   ├── TireSmokeEmitter.ts         # Thick drift smoke, color-tinted by surface
│   │   │   ├── SparkEmitter.ts             # Wall/car collision sparks, directional spread
│   │   │   ├── RainSystem.ts               # Fullscreen rain + splash on car + road ripples
│   │   │   ├── NitroFlameEmitter.ts        # Blue-to-white flame jet from exhaust
│   │   │   └── ConfettiEmitter.ts          # Race finish celebration
│   │   │
│   │   ├── camera/                     # Camera systems
│   │   │   ├── ChaseCamera.ts              # Spring-damper follow cam with speed FOV zoom
│   │   │   ├── DriftCamera.ts              # Wider angle, offset during drift for drama
│   │   │   ├── CinematicCamera.ts          # Replay/finish: orbit, dolly, crane shots
│   │   │   ├── CameraShake.ts              # Impact shake with decay, speed vibration
│   │   │   └── DepthOfField.ts             # Focus on player car, blur background at low speed
│   │   │
│   │   ├── network/                    # Multiplayer systems
│   │   │   ├── NetworkManager.ts           # Socket.IO client, connection lifecycle
│   │   │   ├── ClientPrediction.ts         # Predict own movement, reconcile with server
│   │   │   ├── EntityInterpolation.ts      # Smooth rendering of other players (buffer + lerp)
│   │   │   ├── SnapshotBuffer.ts           # Ring buffer of server state snapshots
│   │   │   ├── InputBuffer.ts              # Stores last 120 frames of input for replay
│   │   │   ├── LobbyClient.ts             # Room create/join/browse, ready system
│   │   │   └── Latency.ts                 # RTT measurement, adaptive interpolation delay
│   │   │
│   │   ├── audio/                      # Audio engine
│   │   │   ├── AudioEngine.ts              # Master mixer, positional audio, listener
│   │   │   ├── EngineSynth.ts              # Procedural engine sound from RPM + load curves
│   │   │   ├── TurboWhine.ts              # Turbocharger whine, pitch = boost pressure
│   │   │   ├── TireAudio.ts               # Screech intensity = drift angle, surface-dependent
│   │   │   ├── ImpactAudio.ts             # Collision sounds scaled by force
│   │   │   ├── AmbienceLayer.ts           # Per-track ambient (city hum, crowd, rain)
│   │   │   └── MusicManager.ts            # Track selection, dynamic mixing (louder in menus)
│   │   │
│   │   ├── ui/                         # React UI overlay
│   │   │   ├── App.tsx                     # Root: routes between menu, lobby, game, results
│   │   │   ├── MainMenu.tsx                # Animated landing: logo, particles, start button
│   │   │   ├── Lobby.tsx                   # Room browser, create room, car select + color
│   │   │   ├── CarShowroom.tsx             # 3D car preview with rotate, paint selector
│   │   │   ├── HUD.tsx                     # In-race: speed, position, lap, minimap, boost meter
│   │   │   ├── Minimap.tsx                 # Top-down SVG track outline with player dots
│   │   │   ├── Countdown.tsx               # 3-2-1-GO with 3D text zoom animation
│   │   │   ├── RaceResults.tsx             # Animated podium, times, awards
│   │   │   ├── Settings.tsx                # Graphics (quality presets), audio, controls, keybinds
│   │   │   └── store.ts                    # Zustand: game state, UI state, settings
│   │   │
│   │   └── utils/
│   │       ├── math.ts                     # Lerp, slerp, clamp, remap, easing functions
│   │       ├── objectPool.ts               # Reusable object pool (particles, decals)
│   │       └── debug.ts                    # Debug overlay, wireframe toggle, physics viz
│   │
│   ├── public/
│   │   ├── models/                     # .glb car models (Draco compressed)
│   │   ├── textures/                   # KTX2 compressed textures (road, skybox, car paint)
│   │   ├── luts/                       # Color grading LUT textures per track
│   │   ├── hdri/                       # HDR environment maps for reflections
│   │   └── audio/                      # SFX samples (impacts, boosts, UI sounds)
│   │
│   └── vite.config.ts                  # WASM support, KTX2 loader, worker bundling
│
├── server/
│   ├── src/
│   │   ├── GameServer.ts                   # Express + Socket.IO, room routing
│   │   ├── RoomManager.ts                  # Create/join/list rooms, max 8 players
│   │   ├── RaceStateMachine.ts             # LOBBY → LOADING → COUNTDOWN → RACING → RESULTS
│   │   ├── ServerPhysics.ts                # Lightweight Rapier instance for validation
│   │   ├── AntiCheat.ts                    # Speed cap, teleport detection, checkpoint order
│   │   ├── PlayerState.ts                  # Per-player: position, velocity, inputs, stats
│   │   ├── Matchmaking.ts                  # Quick match queue, basic Elo
│   │   └── Persistence.ts                  # SQLite: player profiles, lap records, Elo ratings
│   └── package.json
│
├── shared/                             # Shared between client & server
│   ├── types.ts                            # VehicleState, RoomState, InputState, RaceEvent
│   ├── constants.ts                        # ALL tuning values (physics, network, gameplay)
│   ├── protocol.ts                         # Socket event names + payload TypeScript types
│   ├── vehicles.ts                         # Vehicle stat definitions (speed, accel, drift, handling)
│   └── tracks.ts                           # Track metadata (name, checkpoints, spline points)
│
├── package.json                        # Workspace root (npm workspaces)
├── tsconfig.base.json                  # Shared TypeScript config
└── CLAUDE.md                           # ← THIS FILE
```

---

## 🎨 VISUAL QUALITY REQUIREMENTS (NON-NEGOTIABLE)

This section is the most important. Every rendering decision should be measured against: **"Would this impress someone who plays AAA racing games?"**

### 1. Car Rendering — The Star of the Show

**Custom PBR Car Paint Shader** (`PBRCarShader.ts`):
```
LEARNING NOTE: Car paint in real life has multiple layers — base color, metallic flakes,
and a clearcoat on top. We simulate all three for realism.
```
- **Base layer:** Metallic PBR with roughness 0.15-0.3 (very reflective)
- **Flake layer:** Noise-based sparkle that shifts with view angle (Fresnel-driven)
- **Clearcoat layer:** Additional specular highlight on top (Three.js `MeshPhysicalMaterial.clearcoat`)
- **Two-tone paint:** Support color-shifting paint (e.g., blue→purple based on view angle using thin-film interference approximation)
- **Environment reflections:** Real-time cubemap probe updated every 4 frames, placed at car position. The car body should reflect the track, neon lights, and other cars.
- **Window glass:** Transparent with subtle reflection, green tint, rain droplets running down in rain

**Vehicle Lighting:**
- Headlights: `SpotLight` with volumetric cone (visible light beam in fog)
- Tail lights: Emissive red strip, brightness increases on brake
- Underbody neon: Colored `RectAreaLight` under car, color = player's chosen color, illuminates road beneath
- Turn signals: Flash during sharp steering (cosmetic detail)
- Interior dashboard glow: Faint cyan/amber light visible through windows

### 2. Road & Track Surfaces

**Wet Asphalt Shader** (`RoadShader.ts`):
```
LEARNING NOTE: Wet roads look incredible because they act like imperfect mirrors.
We achieve this by combining a rough normal map (asphalt texture) with screen-space
reflections (SSR). The roughness map controls how blurry the reflections are.
```
- **Normal map:** High-detail asphalt texture with cracks, patches, lane markings
- **Roughness:** Low roughness (0.1-0.3) for wet look, varied by puddle map
- **SSR integration:** Road marked with a flag/layer so SSR pass knows to reflect on it
- **Puddles:** Animated ripple normal map in puddle zones, nearly perfect mirror reflection
- **Rumble strips:** Red/white striped kerbs with geometric extrusion (not just texture)
- **Road surface variation:** Grip zones (racing line is darker/cleaner), off-road is lighter gravel texture

### 3. Neon & Lighting System

**Track Lighting** (`TrackLighting.ts`):
```
LEARNING NOTE: Real-time lighting with hundreds of lights is expensive. We use
instanced point lights with a limited radius, and bake distant lights into an
emissive lightmap to fake the effect.
```
- **Neon barrier strips:** Emissive geometry along track barriers, pulsing subtly
- **Overhead light rigs:** Rectangular area lights (RectAreaLight) every 50m
- **Sponsor billboards:** Emissive textures with bloom interaction — these are bright
- **Traffic lights:** At start/finish, functional (red-red-red-green for race start)
- **Instanced lights:** Use `InstancedMesh` for repeated light fixture geometry
- **Light colors per track:**
  - Neon City: Cyan primary, magenta accent, amber warning
  - Coastal Highway: Warm sunset orange, deep blue twilight, white streetlights
  - Mountain Pass: Cold blue fog lights, amber tunnel lights, green forest glow

### 4. Post-Processing (The "Film Look")

**Every effect must be togglable and adjustable in Settings.**

| Effect | Purpose | Settings |
|--------|---------|----------|
| **SSAO** | Adds depth to geometry crevices, makes cars look grounded | Radius, intensity |
| **SSR** | Wet road reflections, car body reflections of surroundings | Quality (ray count), max distance |
| **Bloom** | Neon glow, headlights bleed light, brake lights glow | Threshold, intensity, radius |
| **Motion Blur** | Speed perception, cinematic movement | Intensity (0-1), scales with speed |
| **Chromatic Aberration** | Lens imperfection, intensifies at high speed | Max offset (pixels) |
| **Film Grain** | Cinematic texture, removes the "CG" look | Amount (0-0.15), animated |
| **Color Grading** | Per-track mood (cold blue, warm sunset, toxic green) | LUT texture swap |
| **Depth of Field** | Blur distant/close objects, focus on car | Only in replays + menu |
| **Vignette** | Darkened edges for focus | Intensity (0-0.5) |
| **FXAA/TAA** | Smooth jagged edges | Toggle between FXAA (fast) and TAA (quality) |
| **Lens Flare** | Headlights and bright neons produce lens artifacts | Toggle on/off |

**Quality Presets:**
- **Low:** No SSAO, no SSR, no motion blur, FXAA, 0.75x resolution scale, no film grain
- **Medium:** SSAO (low), bloom, FXAA, motion blur (low), 1.0x resolution
- **High:** All effects at medium quality, TAA, SSR (half-res), 1.0x resolution
- **Ultra:** All effects max quality, SSR (full-res), TAA, 1.0x+ resolution, volumetric fog

### 5. Particle Effects — Sell the Speed

All particles use **GPU instancing** (not CPU sprite systems).

| Particle | Trigger | Visual Style | Count |
|----------|---------|-------------|-------|
| **Tire Smoke** | Drift angle > threshold | Thick white/grey billowing clouds, lit by neon | 200-500 per drift |
| **Sparks** | Wall/car collision | Bright orange/white sparks with trails, directional spray | 50-100 per hit |
| **Nitro Flame** | Boost active | Blue core → white → orange tip, turbulent animated | 100 continuous |
| **Rain** | Weather = rain | Diagonal streaks, splash on impact, windshield droplets | 5000-10000 |
| **Road Spray** | Driving on wet road | Mist kicked up behind car, lit by tail lights | 200 continuous |
| **Confetti** | Race finish | Colored paper bits with physics, wind drift | 500 burst |
| **Exhaust Pop** | Off-throttle at high RPM | Brief orange flash + black smoke puff from exhaust | 20 per pop |

### 6. Camera That Tells a Story

**Chase Camera** (primary):
- Spring-damper follow: `stiffness: 4.0, damping: 0.8`
- Height: 2.5m above, 7m behind car
- FOV: 65° idle → 80° at max speed (smooth lerp over 0.5s)
- Slight delay on rotation (car turns, camera follows 0.1s later — feels cinematic)
- Look-ahead: Camera target is slightly ahead of car's velocity vector

**Drift Camera** (auto-switches during drift):
- Camera swings wider to the outside of the turn
- Drops lower (1.5m height)
- FOV widens to 85°
- Subtle dutch angle (2-5° roll toward drift direction)
- This makes drifts feel DRAMATIC

**Impact Camera:**
- On collision > threshold force: quick zoom-in (FOV 60°) then snap back
- Camera shake with exponential decay (0.3s duration)
- Slight slow-motion (0.8x timescale) for 0.15s on heavy impacts

**Finish Camera:**
- When local player crosses finish:
  - Switch to side tracking shot
  - Depth of field activates (background blurs)
  - Slow-motion to 0.3x
  - Confetti particles
  - 2 second hold, then fly to cinematic orbit view of car

---

## 🏎️ VEHICLE PHYSICS (REALISTIC-ARCADE HYBRID)

### Philosophy
Not pure simulation (too hard to control) and not pure arcade (too floaty). The target is **"realistic feeling but forgiving"** — like Forza Horizon, not Assetto Corsa.

### Rapier Vehicle Setup
```
LEARNING NOTE: Rapier's RaycastVehicle casts rays downward from each wheel to detect
the ground. The suspension is modeled as a spring-damper system. Tire grip is controlled
by a friction curve. This gives us believable physics without simulating actual tire
deformation.
```

**Suspension:**
- Spring rest length: 0.3m
- Spring stiffness: 35.0 (firm, not bouncy)
- Damper compression: 4.5
- Damper relaxation: 2.8
- Max travel: 0.2m

**Tire Friction Curves** (Pacejka-simplified):
```
LEARNING NOTE: The "Pacejka Magic Formula" models real tire grip. As slip angle
increases, grip increases up to a peak then falls off. We use a simplified version:
- Low slip: High grip (normal driving)
- Medium slip: Peak grip (optimal cornering)
- High slip: Reduced grip (drift / loss of control)
This is what makes the car "break loose" predictably during drifts.
```
- Forward friction: 1.2 (normal), 0.8 (off-road)
- Lateral friction: 1.0 (normal) → drops to 0.6 when drift triggered
- Drift trigger: Lateral slip > 0.55 AND player is holding drift button

**Vehicle Stats** (define in `shared/vehicles.ts`):

| Vehicle | Top Speed | Acceleration | Handling | Drift Efficiency | Weight | Style |
|---------|-----------|-------------|----------|-----------------|--------|-------|
| **Ronin** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Medium | Japanese sports car (think GTR) |
| **Viper** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | Heavy | American muscle, wide body |
| **Phantom** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | Light | European hypercar, sleek |
| **Riot** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Light | Kei drift car, small & agile |

Each car has a different **engine sound profile** (RPM curve shape, exhaust character).

---

## 🌐 MULTIPLAYER NETWORKING

### Architecture: Authoritative Server with Client Prediction

```
LEARNING NOTE: The biggest challenge in multiplayer games is LATENCY. When you press
"accelerate", your car shouldn't wait 100ms for the server to respond. So:

1. CLIENT PREDICTION: Your car moves immediately on your screen (feels responsive)
2. SERVER AUTHORITY: Server runs physics too, its result is the "truth"
3. RECONCILIATION: If your prediction was wrong, smoothly correct toward server state
4. INTERPOLATION: Other players' cars are shown slightly in the past (smooth, not jittery)

This is the same architecture used by Rocket League and Forza online.
```

### Network Tick Rates
- **Client → Server (Input):** 60Hz (every frame, send compressed input state)
- **Server → Clients (State):** 20Hz (every 50ms, broadcast all player states)
- **Input packet:** ~32 bytes (bitfield: accel, brake, steer[-1,1] as int16, drift, nitro, seq#)
- **State packet per player:** ~64 bytes (position vec3, rotation quat, velocity vec3, flags)

### Socket.IO Protocol (`shared/protocol.ts`)
Define as TypeScript enums + interfaces:

```typescript
// Events: Client → Server
CLIENT_INPUT            // { seq: number, input: CompressedInput }
CLIENT_READY            // { }
CLIENT_JOIN_ROOM        // { roomId: string, playerName: string, vehicleId: string }
CLIENT_CREATE_ROOM      // { trackId: string, maxPlayers: number, laps: number }
CLIENT_CHAT             // { message: string }  (lobby only)

// Events: Server → Client
SERVER_STATE_UPDATE     // { tick: number, players: PlayerSnapshot[], raceState: RaceState }
SERVER_ROOM_JOINED      // { room: RoomInfo, players: PlayerInfo[] }
SERVER_PLAYER_JOINED    // { player: PlayerInfo }
SERVER_PLAYER_LEFT      // { playerId: string }
SERVER_RACE_COUNTDOWN   // { seconds: number }
SERVER_RACE_START       // { serverTimestamp: number }
SERVER_RACE_FINISH      // { results: RaceResult[] }
SERVER_ROOM_LIST        // { rooms: RoomSummary[] }
```

### Client-Side Prediction Deep Dive (`ClientPrediction.ts`)

```
LEARNING NOTE: Here's the full prediction-reconciliation loop, step by step:

EVERY FRAME on the client:
1. Read local input (WASD/gamepad)
2. Store input in InputBuffer with a sequence number
3. Apply input to local physics immediately (player sees instant response)
4. Send input to server

WHEN SERVER STATE ARRIVES (20Hz):
1. Server says "at tick T, you were at position X"
2. Client checks: "what did I predict for tick T?"
3. If prediction matches server (within tolerance): do nothing, prediction was correct
4. If prediction differs (mismatch):
   a. Snap physics state to server's authoritative state
   b. Re-simulate all inputs from tick T to NOW (replay from InputBuffer)
   c. Result: client is now at correct position with no visible jank

This is called "server reconciliation" or "rollback networking."
```

### Entity Interpolation (`EntityInterpolation.ts`)

```
LEARNING NOTE: Other players' cars can't use prediction (we don't know their inputs).
Instead, we buffer the last 2-3 server snapshots and render them slightly in the past.

Timeline:
  Server sends state at T=0ms, T=50ms, T=100ms
  Client renders at T=current_time - 100ms (2 snapshots behind)
  Client smoothly interpolates between the two surrounding snapshots

This means other cars are always ~100ms behind reality, but they move SMOOTHLY.
For a racing game with cars on a track, 100ms delay is imperceptible.
```

---

## 🕹️ GAMEPLAY SYSTEMS

### Race State Machine (`RaceStateMachine.ts`)
```
LOBBY ──(all ready)──→ LOADING ──(all loaded)──→ COUNTDOWN ──(3-2-1-GO)──→ RACING ──(winner finishes)──→ COOLDOWN ──(5s)──→ RESULTS ──(10s or all click)──→ LOBBY
```
- Server is authoritative for ALL state transitions
- Clients receive state change events and update local UI/game accordingly
- Disconnected players get 30 seconds to reconnect before removal

### Drift-Boost Mechanic (`DriftSystem.ts`)

```
LEARNING NOTE: The drift-boost system is the core "skill expression" mechanic.
It creates a risk-reward loop: drifting is dangerous (you might hit a wall) but
rewards you with speed. Better players chain drifts through corners for huge boosts.
This is what makes the game competitive and satisfying.
```

**Drift Activation:**
- Player holds drift button (Space / LB) + steers
- Car's lateral friction drops from 1.0 to 0.6 → rear slides out
- Counter-steer to control drift angle

**Boost Charging:**
- Charge rate = `drift_angle * drift_speed * time`
- 3 charge levels with visual feedback:
  - **Level 1 (Blue spark):** 0.3s of drift → 1.0s of 15% speed boost
  - **Level 2 (Orange spark):** 1.2s of drift → 1.5s of 25% speed boost
  - **Level 3 (Purple spark):** 2.5s+ of drift → 2.5s of 40% speed boost
- Hitting a wall during drift = lose ALL charge
- Sparks fly from rear wheels matching current charge color

**Boost Release:**
- Release drift button → boost fires
- Visual: exhaust flame color matches level, camera shake, FOV pulse
- Audio: whoosh + bass hit, louder for higher levels
- Speed multiplier applied as force, decays over boost duration

### Track Checkpoint System (`Checkpoints.ts`)
```
LEARNING NOTE: Race position is more complex than "who's ahead on screen."
We need to know exactly how far each player is through the race:
  progress = (completed_laps * total_checkpoints) + current_checkpoint + fraction_to_next
This gives a precise ranking even when cars are in different parts of the track.
```
- Checkpoints are invisible trigger volumes placed every ~100m along track spline
- Must be hit in order (prevents shortcutting)
- Server validates checkpoint order (anti-cheat)
- Progress fraction between checkpoints = dot product of car position onto track spline tangent

---

## 🏗️ DEVELOPMENT PHASES

### PHASE 1: "A Car That Moves" (Foundation)
**Build:** Renderer setup → flat track → vehicle physics → input → chase camera
**Acceptance test:** Drive a car around a flat circuit. Feels responsive and fun.
**Learning outcomes:** Game loop architecture, Rapier physics, Three.js scene graph

### PHASE 2: "Looks Like a Real Game" (Visual Quality)
**Build:** Car shader → road shader → track geometry with elevation → neon lighting → post-processing pipeline → particles (tire smoke, sparks) → skid marks
**Acceptance test:** Screenshot any frame — it looks publishable. Steady 60fps.
**Learning outcomes:** PBR rendering, shaders, post-processing, GPU particles

### PHASE 3: "See Other Cars" (Multiplayer)
**Build:** Socket.IO server → room management → state broadcast → client prediction → entity interpolation → lobby UI
**Acceptance test:** 3 browser tabs racing smoothly. No visible teleporting.
**Learning outcomes:** Client-server architecture, prediction, interpolation, latency

### PHASE 4: "An Actual Race" (Gameplay)
**Build:** Checkpoints → lap counting → position tracking → drift-boost mechanic → HUD → race state machine → countdown → results screen
**Acceptance test:** Complete 3-lap race with positions, drift-boost, results. Feels like a game.
**Learning outcomes:** State machines, trigger volumes, game design patterns

### PHASE 5: "Feel The Speed" (Audio & Juice)
**Build:** Engine sound synthesis → tire audio → impact SFX → music → screen effects (speed lines, impact flash) → camera improvements (drift cam, finish cam)
**Acceptance test:** Close your eyes — you can hear it's a racing game. Open eyes — every action has satisfying visual feedback.
**Learning outcomes:** Web Audio API, sound design, "game juice" principles

### PHASE 6: "One More Race" (Content & Polish)
**Build:** 3 tracks → 4 vehicles → time trial with ghost → quick match → settings menu → performance optimization pass
**Acceptance test:** You'd send this link to a friend and they'd say "you made THIS in a browser?!"
**Learning outcomes:** Content pipeline, matchmaking, Elo rating, optimization

---

## ⚙️ PERFORMANCE BUDGETS

| Metric | Target | Hard Limit |
|--------|--------|-----------|
| FPS | 60 | Never below 30 |
| Draw calls | < 150 | < 300 |
| Triangles | < 500K | < 1M |
| Texture memory | < 200MB | < 400MB |
| Network bandwidth | < 5KB/s per player | < 15KB/s |
| Initial load | < 6 seconds | < 15 seconds |
| WASM init (Rapier) | < 1 second | < 3 seconds |

**Optimization techniques to use:**
- **Instanced meshes** for repeated geometry (barriers, lights, props, particles)
- **LOD** (Level of Detail): 3 LOD levels for track props, 2 for cars
- **Texture atlasing** & **KTX2 compression** (GPU-compressed textures, ~4x smaller)
- **Draco-compressed GLTF** for all 3D models
- **Object pooling** for particles and decals (never allocate during gameplay)
- **Frustum culling** (built-in Three.js, but verify it's working)
- **Occlusion culling** for tunnel sections (disable rendering of objects behind walls)
- **Deferred rendering hints:** Limit real-time lights to radius of influence

---

## 📝 CODE STANDARDS

### Every File Must Have:
```typescript
/**
 * LEARNING NOTE: [Concept this file teaches]
 *
 * [2-4 sentences explaining the game dev concept implemented here,
 *  as if teaching someone who knows TypeScript but not game development.
 *  Include "why" not just "what".]
 *
 * Key concepts: [list of technical terms introduced]
 * Further reading: [link to relevant article/tutorial if applicable]
 */
```

### Naming Conventions:
- Files: `PascalCase.ts` for classes, `camelCase.ts` for utility modules
- Classes: `PascalCase`
- Functions/methods: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` (all in `shared/constants.ts`)
- Events: `SCREAMING_SNAKE_CASE` (all in `shared/protocol.ts`)
- Physics tuning values: Always in `shared/constants.ts`, never inline magic numbers

### TypeScript Rules:
- `strict: true` — no exceptions
- No `any` — use `unknown` + type guards if type is truly unknown
- All Socket.IO events must be typed (use typed event maps)
- Shared types in `shared/types.ts` — imported by both client and server
- Use branded types for IDs: `type PlayerId = string & { __brand: 'PlayerId' }`

---

## 🎓 LEARNING MILESTONE CHECKLIST

After completing each phase, you should be able to explain:

| Phase | Concepts You Should Understand |
|-------|-------------------------------|
| **1** | Fixed-timestep game loop (why physics needs constant dt), Three.js scene graph (scene → mesh → geometry + material), Rapier RaycastVehicle (suspension springs, ray-ground detection), input abstraction layer |
| **2** | PBR material model (metallic/roughness workflow), screen-space reflections (what "screen space" means), bloom (threshold + blur + composite), GPU instanced particles (one draw call, thousands of objects), color grading with LUTs |
| **3** | Authoritative server model (why trust the server), client-side prediction (predict → reconcile), entity interpolation (render in the past), snapshot buffers, Socket.IO rooms & namespaces |
| **4** | Finite state machines in games, trigger volumes (AABB/sphere intersection), race position calculation (lap + checkpoint + fraction), risk-reward mechanic design (drift-boost) |
| **5** | Web Audio API graph (source → effects → destination), procedural sound synthesis (oscillators + filters = engine), game "juice" (feedback loops that make actions feel satisfying), camera as storytelling tool |
| **6** | Asset pipeline (compress, atlas, LOD), matchmaking (Elo calculation), ghost replay (recording & playback of input/state), performance profiling (GPU timeline, draw call batching) |

---

## 🚨 ANTI-PATTERNS TO AVOID

- **DO NOT** use `setTimeout`/`setInterval` for game logic — use the game loop accumulator
- **DO NOT** create objects during gameplay (`new Vector3()` every frame) — pre-allocate & reuse
- **DO NOT** use `JSON.stringify` for network packets — use binary/msgpack or manual packing
- **DO NOT** put physics on the render thread — use a fixed timestep separate from frame rate
- **DO NOT** make the client authoritative for anything — server decides positions, checkpoints, results
- **DO NOT** skip the post-processing pipeline — it's 50% of the visual quality
- **DO NOT** use CSS 3D transforms for game rendering — everything is Three.js on canvas
- **DO NOT** use `console.log` in production — use a debug overlay toggle

---

## 🏁 DEFINITION OF DONE

The game is "done" when:
- [ ] 3 visually distinct tracks with unique lighting, weather, and color palettes
- [ ] 4 vehicles with different stats, sounds, and visual character
- [ ] 2-8 player online multiplayer with < 100ms perceived latency
- [ ] Lobby system: create room, browse rooms, join by code, quick match
- [ ] Drift-boost mechanic with 3 charge levels and visual/audio feedback
- [ ] Full post-processing pipeline (SSAO, SSR, bloom, motion blur, color grading, grain)
- [ ] Procedural engine sound synthesis (not audio file playback)
- [ ] Chase camera with drift-cam, finish-cam, and speed-based FOV
- [ ] Race state machine: countdown → racing → results with animated transitions
- [ ] HUD: speedometer, position, lap counter, minimap, boost meter
- [ ] Graphics quality presets (Low/Medium/High/Ultra) that work
- [ ] 60 FPS on mid-range hardware (GTX 1060 / M1 Mac) at Medium settings
- [ ] Every source file has a LEARNING NOTE explaining the game dev concepts it implements
- [ ] A friend can click a link and be racing you within 15 seconds
