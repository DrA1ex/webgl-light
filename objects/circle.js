import {IColoredObject} from "./base.js";
import {Vector2} from "../vector.js";
import * as CircleUtils from "../utils/circle.js";
import {BoundaryBox} from "../utils/boundary.js";

const CircleSegmentCount = 48;

export class CircleObject extends IColoredObject {
    static #PolyPointsCache = CircleUtils.generateDiskMesh(CircleSegmentCount);
    static #IndexesCache = CircleUtils.generateDiskIndexed(CircleSegmentCount);
    static #PointsCache = this.#PolyPointsCache.slice(2);

    #boundary = new BoundaryBox(0, 0, 0, 0);
    get boundary() {
        return this.#boundary.update(
            this.x - this.radius, this.x + this.radius,
            this.y - this.radius, this.y + this.radius
        );
    }

    /** @type {number} */
    #radius;

    get radius() {return this.#radius;}
    set radius(value) {
        this.#radius = value;
        this.size.x = value * 2;
        this.size.y = value * 2;
    }

    constructor(x, y, radius) {
        super(new Vector2(x, y), new Vector2(radius * 2, radius * 2));

        this.radius = radius;
    }

    get pointsCount() {
        return CircleSegmentCount;
    }

    points() {
        return CircleObject.#PointsCache.map((p, i) => {
            const result = p * this.radius * 2;

            if (i % 2 === 0) {
                return result + this.x;
            } else {
                return result + this.y;
            }
        });
    }

    get polyPointsCount() {
        return CircleSegmentCount + 1;
    }

    polyPoints() {
        return CircleObject.#PolyPointsCache;
    }

    get indexesCount() {
        return CircleSegmentCount * 3;
    }

    indexes() {
        return CircleObject.#IndexesCache;
    }
}