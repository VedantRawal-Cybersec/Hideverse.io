import { Application, Color, Entity, StandardMaterial } from 'playcanvas';
import type { MapDefinition, Triplet } from '../maps/map-catalog';
import type { MapVisualProfile } from './map-visual-profile';

type AnimatedBeacon = {
  entity: Entity;
  radius: number;
  phase: number;
};

function material(
  color: Triplet,
  emissiveIntensity: number,
  gloss = 0.28,
  metalness = 0.04,
): StandardMaterial {
  const result = new StandardMaterial();
  result.diffuse = new Color(color[0], color[1], color[2]);
  result.emissive = new Color(color[0], color[1], color[2]);
  result.emissiveIntensity = emissiveIntensity;
  result.gloss = gloss;
  result.metalness = metalness;
  result.update();
  return result;
}

function darken(color: Triplet, scale: number): Triplet {
  return [color[0] * scale, color[1] * scale, color[2] * scale];
}

export class EnvironmentPolish {
  private readonly beacons: AnimatedBeacon[] = [];
  private readonly qualityEntities: Entity[] = [];
  private elapsed = 0;
  private reduced = false;

  constructor(
    private readonly app: Application,
    private readonly map: MapDefinition,
    private readonly coarsePointer: boolean,
    private readonly profile: MapVisualProfile,
  ) {
    this.createObjectiveBeacons();
    this.createWayfindingPosts();
    this.createAccentLights();
  }

  private createObjectiveBeacons(): void {
    const beaconMaterial = material(
      this.profile.accent,
      this.coarsePointer ? 0.16 : 0.34,
      0.38,
      0.05,
    );
    const coreMaterial = material(darken(this.profile.accent, 0.72), 0.12, 0.32, 0.08);

    for (const [index, objective] of this.map.objectives.entries()) {
      const ring = new Entity(`objective-beacon-${objective.id}`);
      ring.addComponent('render', { type: 'cylinder' });
      const radius = Math.max(0.52, Math.min(0.9, objective.radius * 0.28));
      ring.setLocalScale(radius, 0.025, radius);
      ring.setPosition(
        objective.position[0],
        objective.position[1] + 0.06,
        objective.position[2],
      );
      if (ring.render) ring.render.material = beaconMaterial;
      this.app.root.addChild(ring);

      const core = new Entity(`objective-core-${objective.id}`);
      core.addComponent('render', { type: 'cylinder' });
      core.setLocalScale(0.12, this.coarsePointer ? 0.42 : 0.72, 0.12);
      core.setPosition(
        objective.position[0],
        objective.position[1] + (this.coarsePointer ? 0.48 : 0.78),
        objective.position[2],
      );
      if (core.render) core.render.material = coreMaterial;
      this.app.root.addChild(core);

      this.beacons.push({
        entity: ring,
        radius,
        phase: index * 1.37,
      });

      if (!this.coarsePointer && index < 3) {
        const glow = new Entity(`objective-glow-${objective.id}`);
        glow.addComponent('light', {
          type: 'omni',
          color: new Color(
            this.profile.accent[0],
            this.profile.accent[1],
            this.profile.accent[2],
          ),
          intensity: 0.42,
          range: 7.5,
          castShadows: false,
        });
        glow.setPosition(
          objective.position[0],
          objective.position[1] + 1.25,
          objective.position[2],
        );
        this.app.root.addChild(glow);
        this.qualityEntities.push(glow);
      }
    }
  }

  private createWayfindingPosts(): void {
    const postMaterial = material(
      darken(this.profile.accent, 0.7),
      this.coarsePointer ? 0.04 : 0.1,
      0.3,
      0.18,
    );
    const capMaterial = material(this.profile.accent, this.coarsePointer ? 0.12 : 0.24, 0.42, 0.08);
    const nodes = this.map.navNodes.slice(0, this.coarsePointer ? 2 : 5);

    for (const [index, node] of nodes.entries()) {
      const post = new Entity(`wayfinding-post-${node.id}`);
      post.addComponent('render', { type: 'box' });
      post.setLocalScale(0.13, this.coarsePointer ? 0.8 : 1.15, 0.13);
      post.setPosition(
        node.position[0] + (index % 2 === 0 ? 0.7 : -0.7),
        node.position[1] + (this.coarsePointer ? 0.42 : 0.6),
        node.position[2] + 0.65,
      );
      if (post.render) post.render.material = postMaterial;
      this.app.root.addChild(post);

      const cap = new Entity(`wayfinding-cap-${node.id}`);
      cap.addComponent('render', { type: 'box' });
      cap.setLocalScale(0.34, 0.08, 0.34);
      cap.setPosition(
        node.position[0] + (index % 2 === 0 ? 0.7 : -0.7),
        node.position[1] + (this.coarsePointer ? 0.84 : 1.2),
        node.position[2] + 0.65,
      );
      if (cap.render) cap.render.material = capMaterial;
      this.app.root.addChild(cap);

      if (!this.coarsePointer) {
        this.qualityEntities.push(post, cap);
      }
    }
  }

  private createAccentLights(): void {
    if (this.coarsePointer) return;

    const positions = this.map.navNodes
      .filter((_, index) => index % Math.max(1, Math.floor(this.map.navNodes.length / 3)) === 0)
      .slice(0, 3);

    for (const [index, node] of positions.entries()) {
      const light = new Entity(`environment-accent-${index}`);
      light.addComponent('light', {
        type: 'omni',
        color: new Color(
          this.profile.accent[0],
          this.profile.accent[1],
          this.profile.accent[2],
        ),
        intensity: 0.22,
        range: 9,
        castShadows: false,
      });
      light.setPosition(node.position[0], node.position[1] + 2.7, node.position[2]);
      this.app.root.addChild(light);
      this.qualityEntities.push(light);
    }
  }

  update(deltaSeconds: number): void {
    this.elapsed += Math.min(deltaSeconds, 0.1);
    for (const beacon of this.beacons) {
      const pulse = 1 + Math.sin(this.elapsed * 2.1 + beacon.phase) * 0.075;
      beacon.entity.setLocalScale(beacon.radius * pulse, 0.025, beacon.radius * pulse);
    }
  }

  setReduced(reduced: boolean): void {
    if (this.reduced === reduced) return;
    this.reduced = reduced;
    for (const entity of this.qualityEntities) entity.enabled = !reduced;
  }

  destroy(): void {
    for (const beacon of this.beacons) beacon.entity.destroy();
    for (const entity of this.qualityEntities) {
      if (entity.getGuid()) entity.destroy();
    }
    this.beacons.length = 0;
    this.qualityEntities.length = 0;
  }
}
