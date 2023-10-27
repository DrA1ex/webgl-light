import {IColoredObject} from "./base.js";
import {Vector2} from "../vector.js";

/**
 * @extends {IRenderObject}
 */
export class RectObject extends IColoredObject {
    /** @type {number} */
    get width() {return this.size.x; };

    /** @type {number} */
    get height() {return this.size.y; };

    constructor(x, y, width, height) {
        super(new Vector2(x, y), new Vector2(width, height));
    }

    get pointsCount() {
        return 4;
    }
    points() {
        return [
            this.x - this.width / 2, this.y - this.height / 2,
            this.x + this.width / 2, this.y - this.height / 2,
            this.x + this.width / 2, this.y + this.height / 2,
            this.x - this.width / 2, this.y + this.height / 2,
        ]
    }

    get polyPointsCount() {
        return 4;
    }

    polyPoints() {
        return [
            -0.5, -0.5,
            0.5, -0.5,
            0.5, 0.5,
            -0.5, 0.5,
        ]
    }

    get indexesCount() {
        return 6;
    }

    indexes() {
        return [
            0, 1, 2,
            2, 3, 0
        ];
    }
}