declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
  }

  export class GameEntity {
    position: Vector3;
    name: string;
  }

  export class EntityManager {
    add(entity: GameEntity): this;
    update(delta: number): this;
  }
}
