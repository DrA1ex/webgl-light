import {CircleObject} from "./circle.js";

export class Light {
    intensity;
    radius;

    object;
    #mask;

    get boundary() {return this.object.boundary;}

    get mask() {
        this.#mask.position.x = this.x;
        this.#mask.position.y = this.y;
        this.#mask.radius = this.radius;
        this.#mask.color = this.color;

        return this.#mask;
    }

    get position() {return this.object.position;};
    get x() {return this.position.x;}
    get y() {return this.position.y;}

    get opacity() {return this.object.opacity;}
    set opacity(value) {this.object.opacity = value;}

    get color() {return this.object.color;}
    set color(value) {this.object.color = value;}

    get colorComponents() {return this.object.colorComponents;}

    constructor(x, y, color = "#ffffff", intensity = 0.5, radius = 400) {
        this.object = new CircleObject(x, y, 10);
        this.object.castShadows = false;
        this.color = color;

        this.#mask = new CircleObject(x, y, radius);

        this.intensity = intensity;
        this.radius = radius;
    }
}