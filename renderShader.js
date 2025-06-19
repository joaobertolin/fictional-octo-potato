export function getRenderShaderCode(numParticleTypes, canvasWidth, canvasHeight, particleColors) {
  let colorAssignments = '';
  for (let i = 0; i < numParticleTypes; i++) {
    colorAssignments += `if (p.ptype == ${i}u) { c = ${particleColors[i]}; }\n`;
  }
  colorAssignments += `if (p.ptype >= ${numParticleTypes}u) { c = vec3f(1.0, 1.0, 0.0); }\n`;

  return `
    struct Particle {
      pos: vec2f,
      vel: vec2f,
      acc: vec2f,
      ptype: u32,
      pad: u32
    };

    @group(0) @binding(0) var<storage, read> particles: array<Particle>;

    struct VSOut {
      @builtin(position) pos: vec4f,
      @location(0) color: vec3f
    };

    @vertex
    fn vs_main(@builtin(vertex_index) i: u32) -> VSOut {
      let p = particles[i];
      var c = vec3f(0.5);
      ${colorAssignments}

      var out: VSOut;
      out.pos = vec4f(
        (p.pos.x / ${canvasWidth}.0) * 2.0 - 1.0,
        (p.pos.y / ${canvasHeight}.0) * -2.0 + 1.0,
        0.0, 1.0);
      out.color = c;
      return out;
    }

    @fragment
    fn fs_main(in: VSOut) -> @location(0) vec4f {
      return vec4f(in.color, 1.0); // Opacidade total
    }
  `;
}
