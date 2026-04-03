/**
 * LEARNING NOTE: Raycast Vehicle Physics
 *
 * A raycast vehicle is the standard technique for arcade-to-sim racing physics.
 * Instead of simulating actual wheel geometry rolling on the ground, we cast
 * rays downward from each wheel position. Where the ray hits the ground, we
 * simulate a spring-damper suspension (Hooke's law + damping force).
 *
 * The tire friction model determines grip: at low slip angles the tire grips
 * fully, at high slip angles (drifting) grip reduces. Front wheels have higher
 * friction than rear wheels — this creates natural understeer at the limit,
 * which feels predictable and controllable. Lower rear friction also lets
 * the tail step out during aggressive turns, which is fun.
 *
 * Key concepts: raycast vehicle, suspension (Hooke's law), tire slip, front/rear grip balance
 * Further reading: https://rapier.rs/docs/user_guides/javascript/character_controller
 */

import type RAPIER from '@dimforge/rapier3d-compat';
import {
  VEHICLE,
  WHEELS,
  WHEEL_POSITIONS,
  STEERING,
  ENGINE,
} from '@neon-drift/shared';
import type { InputState, VehicleState, Vec3Like } from '@neon-drift/shared';
import { clamp } from '../utils/math.js';

export class VehiclePhysics {
  private rapier: typeof RAPIER;
  private world: RAPIER.World;
  private chassisBody: RAPIER.RigidBody;
  private controller: RAPIER.DynamicRayCastVehicleController;
  private currentSteering = 0;

  // Pre-allocated output objects to avoid per-frame allocation
  private readonly _state: VehicleState = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    speed: 0,
    engineRpm: 0,
  };

  constructor(
    rapier: typeof RAPIER,
    world: RAPIER.World,
    startPos: Vec3Like,
    startRot: { x: number; y: number; z: number; w: number },
  ) {
    this.rapier = rapier;
    this.world = world;

    // Create chassis rigid body
    const chassisDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, startPos.y, startPos.z)
      .setRotation(startRot)
      .setCcdEnabled(true)
      .setAngularDamping(STEERING.ANGULAR_DAMPING)
      .setLinearDamping(0.1);

    this.chassisBody = world.createRigidBody(chassisDesc);

    // Create chassis collider
    const { CHASSIS_HALF_EXTENTS, CHASSIS_MASS, CENTER_OF_MASS_Y_OFFSET } = VEHICLE;
    const colliderDesc = rapier.ColliderDesc
      .cuboid(CHASSIS_HALF_EXTENTS.x, CHASSIS_HALF_EXTENTS.y, CHASSIS_HALF_EXTENTS.z)
      .setMass(CHASSIS_MASS)
      .setFriction(0.6)
      .setRestitution(0.45); // realistic car-to-car bounce
    world.createCollider(colliderDesc, this.chassisBody);

    // Set proper inertia: LOW on Y-axis so the car can yaw (turn) easily,
    // HIGH on X and Z axes so it resists roll and pitch (doesn't flip over).
    // This is the single most important tuning for steering feel.
    this.chassisBody.setAdditionalMassProperties(
      0,
      { x: 0, y: CENTER_OF_MASS_Y_OFFSET, z: 0 },
      { x: 800, y: 20, z: 800 },  // low Y = easy yaw, high X/Z = no roll/flip
      { x: 0, y: 0, z: 0, w: 1 },
      false,
    );

    // Create vehicle controller
    this.controller = world.createVehicleController(this.chassisBody);

    // Add wheels
    const suspDir = new rapier.Vector3(0, -1, 0);
    const axleDir = new rapier.Vector3(-1, 0, 0);

    for (const wp of WHEEL_POSITIONS) {
      this.controller.addWheel(
        new rapier.Vector3(wp.x, wp.y, wp.z),
        suspDir,
        axleDir,
        WHEELS.SUSPENSION_REST_LENGTH,
        WHEELS.RADIUS,
      );
    }

    // Configure wheels — front wheels get more grip than rear for natural steering
    const numWheels = this.controller.numWheels();
    for (let i = 0; i < numWheels; i++) {
      this.controller.setWheelSuspensionStiffness(i, WHEELS.SUSPENSION_STIFFNESS);
      this.controller.setWheelMaxSuspensionTravel(i, WHEELS.MAX_SUSPENSION_TRAVEL);
      this.controller.setWheelMaxSuspensionForce(i, WHEELS.MAX_SUSPENSION_FORCE);
      this.controller.setWheelSuspensionCompression(i, WHEELS.SUSPENSION_COMPRESSION);
      this.controller.setWheelSuspensionRelaxation(i, WHEELS.SUSPENSION_RELAXATION);

      // Front wheels (0, 1) get higher friction for responsive steering
      // Rear wheels (2, 3) get lower friction allowing the tail to swing
      const friction = i < 2 ? WHEELS.FRONT_FRICTION_SLIP : WHEELS.REAR_FRICTION_SLIP;
      this.controller.setWheelFrictionSlip(i, friction);
    }
  }

  /** Apply player input to the vehicle. Call before update(). */
  applyInput(input: InputState, dt: number): void {
    const speed = this.getForwardSpeed();

    // --- Steering ---
    let targetSteering = 0;
    if (input.steerLeft) targetSteering -= STEERING.MAX_ANGLE;
    if (input.steerRight) targetSteering += STEERING.MAX_ANGLE;

    // Smoothly approach target steering
    if (targetSteering !== 0) {
      const steerDelta = STEERING.SPEED * dt;
      if (this.currentSteering < targetSteering) {
        this.currentSteering = Math.min(this.currentSteering + steerDelta, targetSteering);
      } else {
        this.currentSteering = Math.max(this.currentSteering - steerDelta, targetSteering);
      }
    } else {
      const returnDelta = STEERING.RETURN_SPEED * dt;
      if (this.currentSteering > 0) {
        this.currentSteering = Math.max(0, this.currentSteering - returnDelta);
      } else {
        this.currentSteering = Math.min(0, this.currentSteering + returnDelta);
      }
    }

    // Speed-sensitive steering: full angle at low speed, reduced at high speed
    const absSpeed = Math.abs(speed);
    const speedFactor = absSpeed < STEERING.SPEED_SENSITIVE_START
      ? 1.0
      : clamp(
          1.0 - (absSpeed - STEERING.SPEED_SENSITIVE_START) /
            (STEERING.SPEED_SENSITIVE_FULL - STEERING.SPEED_SENSITIVE_START) *
            (1.0 - STEERING.SPEED_SENSITIVE_MIN),
          STEERING.SPEED_SENSITIVE_MIN,
          1.0,
        );
    const effectiveSteering = this.currentSteering * speedFactor;

    // Apply steering to front wheels only
    this.controller.setWheelSteering(0, effectiveSteering);
    this.controller.setWheelSteering(1, effectiveSteering);

    // --- Engine / Braking ---
    let engineForce = 0;
    let brakeForce = 0;

    if (input.accelerate) {
      engineForce = ENGINE.MAX_FORCE;
    } else if (input.brake) {
      if (speed > 1.0) {
        brakeForce = ENGINE.BRAKE_FORCE;
      } else {
        engineForce = -ENGINE.REVERSE_FORCE;
      }
    } else {
      brakeForce = ENGINE.ROLLING_RESISTANCE;
    }

    // RWD: engine force on rear wheels only
    this.controller.setWheelEngineForce(2, engineForce);
    this.controller.setWheelEngineForce(3, engineForce);

    // Braking on all 4 wheels
    for (let i = 0; i < 4; i++) {
      this.controller.setWheelBrake(i, brakeForce);
    }

    // Drift: holding Space reduces rear wheel friction so the tail slides out
    if (input.drift && absSpeed > 3) {
      this.controller.setWheelFrictionSlip(2, WHEELS.REAR_FRICTION_SLIP * 0.4);
      this.controller.setWheelFrictionSlip(3, WHEELS.REAR_FRICTION_SLIP * 0.4);
    } else {
      this.controller.setWheelFrictionSlip(2, WHEELS.REAR_FRICTION_SLIP);
      this.controller.setWheelFrictionSlip(3, WHEELS.REAR_FRICTION_SLIP);
    }
  }

  /** Step the vehicle controller. Call BEFORE world.step(). */
  update(dt: number): void {
    this.controller.updateVehicle(dt);
  }

  /** Read the current physics state. Returns a reused object (don't store references). */
  getState(): Readonly<VehicleState> {
    const pos = this.chassisBody.translation();
    const rot = this.chassisBody.rotation();
    const vel = this.chassisBody.linvel();

    this._state.position.x = pos.x;
    this._state.position.y = pos.y;
    this._state.position.z = pos.z;
    this._state.rotation.x = rot.x;
    this._state.rotation.y = rot.y;
    this._state.rotation.z = rot.z;
    this._state.rotation.w = rot.w;
    this._state.velocity.x = vel.x;
    this._state.velocity.y = vel.y;
    this._state.velocity.z = vel.z;
    this._state.speed = this.getForwardSpeed();
    this._state.engineRpm = 0; // Phase 5

    return this._state;
  }

  /** Speed projected onto the car's forward axis (m/s). Positive = forward. */
  getForwardSpeed(): number {
    const vel = this.chassisBody.linvel();
    const rot = this.chassisBody.rotation();

    // Extract forward direction (local +Z) from quaternion
    const fx = 2 * (rot.x * rot.z + rot.w * rot.y);
    const fy = 2 * (rot.y * rot.z - rot.w * rot.x);
    const fz = 1 - 2 * (rot.x * rot.x + rot.y * rot.y);

    return vel.x * fx + vel.y * fy + vel.z * fz;
  }

  /** Get a wheel's world-space info for visual positioning. */
  getWheelTransform(index: number): {
    contactPoint: Vec3Like | null;
    suspensionLength: number;
    steering: number;
    rotation: number;
  } {
    return {
      contactPoint: this.controller.wheelContactPoint(index)
        ? {
            x: this.controller.wheelContactPoint(index)!.x,
            y: this.controller.wheelContactPoint(index)!.y,
            z: this.controller.wheelContactPoint(index)!.z,
          }
        : null,
      suspensionLength: this.controller.wheelSuspensionLength(index) ?? WHEELS.SUSPENSION_REST_LENGTH,
      steering: this.controller.wheelSteering(index) ?? 0,
      rotation: this.controller.wheelRotation(index) ?? 0,
    };
  }

  /** Get the chassis rigid body (for camera targeting, etc.). */
  getChassisBody(): RAPIER.RigidBody {
    return this.chassisBody;
  }

  dispose(): void {
    this.world.removeRigidBody(this.chassisBody);
  }
}
