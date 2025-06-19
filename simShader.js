export const simShader = /* wgsl */ `
struct Particle {
  pos: vec2f,
  vel: vec2f,
  acc: vec2f,
  ptype: u32,
  pad: u32
};

struct SimParams {
  radius: f32,
  delta_t: f32,
  friction: f32,
  repulsion: f32,
  attraction: f32,
  k: f32,
  balance: f32,
  canvasWidth: f32,
  canvasHeight: f32,
  numParticleTypes: f32,
  ratio: f32,
  forceMultiplier: f32,
  maxExpectedNeighbors: f32,
  forceOffset: f32
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read> forceTable: array<f32>;
@group(0) @binding(2) var<uniform> simParams: SimParams;
@group(0) @binding(3) var<storage, read> radioByType: array<f32>;
@group(0) @binding(4) var<storage, read> gridParticles: array<u32>;
@group(0) @binding(5) var<storage, read> gridOffsets: array<u32>;
@group(0) @binding(6) var<storage, read> gridCounts: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }

  let me = particles[i];
  var force = vec2f(0.0);
  let myType = me.ptype;
  let effectiveRadius = simParams.radius + (simParams.radius * radioByType[myType] * simParams.ratio);
  var neighbors_count = 0u;

  let cellSize = simParams.radius;
  let gridWidth = u32(simParams.canvasWidth / cellSize);
  let gridHeight = u32(simParams.canvasHeight / cellSize);
  let cellX = u32(me.pos.x / cellSize);
  let cellY = u32(me.pos.y / cellSize);

  for (var dy: i32 = -1; dy <= 1; dy++) {
    for (var dx: i32 = -1; dx <= 1; dx++) {
      let nx = i32(cellX) + dx;
      let ny = i32(cellY) + dy;
      if (nx < 0 || ny < 0 || nx >= i32(gridWidth) || ny >= i32(gridHeight)) { continue; }

      let neighborIndex = u32(ny) * gridWidth + u32(nx);
      let offset = gridOffsets[neighborIndex];
      let count = gridCounts[neighborIndex];

      for (var n = 0u; n < count; n++) {
        let j = gridParticles[offset + n];
        if (i == j) { continue; }

        let other = particles[j];
        var dir = other.pos - me.pos;

        dir.x = dir.x - floor(dir.x / simParams.canvasWidth + 0.5) * simParams.canvasWidth;
        dir.y = dir.y - floor(dir.y / simParams.canvasHeight + 0.5) * simParams.canvasHeight;

        let dist = length(dir);
        if (dist == 0.0 || dist > effectiveRadius) { continue; }

        neighbors_count++;

        let r = dist / effectiveRadius;
        let a = forceTable[me.ptype * u32(simParams.numParticleTypes) + other.ptype];
        let rep_decay = r * simParams.k;
        let repulsion_ = simParams.repulsion * (1.0 / (1.0 + rep_decay * rep_decay));
        let attraction_ = simParams.attraction * r * r;

        let f = a * (repulsion_ - attraction_) * simParams.forceMultiplier;
        force += normalize(dir) * f;
      }
    }
  }

  let normalized_density = f32(neighbors_count) / simParams.maxExpectedNeighbors;
  let clamped_density = clamp(normalized_density, 0.0, 1.0);

  let min_force_mult = mix(1.0, 0.01, simParams.balance);
  let max_force_mult = mix(1.0, 4.0, simParams.balance);
  let adaptive_multiplier = mix(max_force_mult, min_force_mult, clamped_density);

  var vel = me.vel * simParams.friction;
  vel += force * simParams.delta_t * adaptive_multiplier;
  var pos = me.pos + vel * simParams.delta_t;

  let temp_x = pos.x + simParams.canvasWidth;
  let wrapped_x = temp_x - simParams.canvasWidth * floor(temp_x / simParams.canvasWidth);
  let temp_y = pos.y + simParams.canvasHeight;
  let wrapped_y = temp_y - simParams.canvasHeight * floor(temp_y / simParams.canvasHeight);
  pos = vec2f(wrapped_x, wrapped_y);

  particles[i].pos = pos;
  particles[i].vel = vel;
}
`;
