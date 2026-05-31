class RingParticlesPainter {
  static get inputProperties() {
    return [
      '--ring-radius',
      '--ring-thickness',
      '--particle-color',
      '--particle-max-alpha',
      '--animation-tick',
      '--cursor-x',
      '--cursor-y'
    ];
  }

  paint(ctx, geom, properties) {
    const radius = parseFloat(properties.get('--ring-radius')?.toString()) || 200;
    const thickness = parseFloat(properties.get('--ring-thickness')?.toString()) || 500;
    const color = properties.get('--particle-color')?.toString().trim() || 'rgba(238, 202, 102, 1)';
    const maxAlpha = parseFloat(properties.get('--particle-max-alpha')?.toString()) || 0.08;
    const tick = parseFloat(properties.get('--animation-tick')?.toString()) || 0;
    
    // Parse cursor (default to center)
    let cx = geom.width / 2;
    let cy = geom.height / 2;
    
    const cursorX = properties.get('--cursor-x')?.toString().trim() || '50%';
    const cursorY = properties.get('--cursor-y')?.toString().trim() || '50%';
    
    if (cursorX.endsWith('%')) cx = geom.width * (parseFloat(cursorX) / 100);
    else if (cursorX) cx = parseFloat(cursorX);
    
    if (cursorY.endsWith('%')) cy = geom.height * (parseFloat(cursorY) / 100);
    else if (cursorY) cy = parseFloat(cursorY);

    const numParticles = 150;
    
    for (let i = 0; i < numParticles; i++) {
      // Deterministic pseudo-random layout
      const angle = (i * 137.5) * (Math.PI / 180) + (tick * Math.PI * 2 * 0.1);
      
      // Spread particles across the thickness
      const normalizedOffset = Math.sin(i * 123.45); // -1 to 1
      const distOffset = normalizedOffset * (thickness / 2);
      
      // Dynamic radial breathing based on tick
      const r = radius + distOffset + Math.sin(tick * Math.PI * 2 + i) * 30;
      
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      
      // Distance from center for fade-easing (ease-in behavior)
      const distFromCenter = Math.abs(r - radius);
      
      // Alpha drops off towards the edges of the thickness band
      let alpha = maxAlpha * Math.max(0, 1 - Math.pow(distFromCenter / (thickness / 2), 2));
      
      if (alpha <= 0.001) continue;
      
      ctx.beginPath();
      // Particle size variation
      const size = 1 + (Math.sin(i * 321.1) * 0.5 + 0.5) * 2;
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
  }
}

registerPaint('ring-particles', RingParticlesPainter);
