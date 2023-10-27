import * as ColorUtils from "../utils/color.js";

/** @abstract */
export class IRenderObject {
    /** @type {Vector2} */
    position;

    /** @type {Vector2} */
    size;

    get x() {return this.position.x;}
    get y() {return this.position.y;}

    castShadows = true;

    constructor(position, size) {
        this.position = position;
        this.size = size;
    }

    /**
     * @abstract
     * @return {number}
     */
    get pointsCount() {}

    /**
     * @abstract
     * @return {number[]}
     */
    points() {}

    /**
     * @abstract
     * @return {number}
     */
    get polyPointsCount() {}

    /**
     * @abstract
     * @return {number[]}
     */
    polyPoints() {}

    /**
     * @abstract
     * @return {number}
     */
    get indexesCount() {}

    /**
     * @abstract
     * @return {number[]}
     */
    indexes() {}
}


export function IColoredMixin(type = Object) {
    return class extends type {
        constructor(...params) {super(...params);}

        #colorComponents = null;
        #color = "#626262";

        opacity = 1;

        get color() {return this.#color;}

        /**
         * @param {string} value
         */
        set color(value) {
            this.#color = value;
            this.#colorComponents = null;
        }

        get colorComponents() {
            if (!this.#colorComponents) {
                this.#colorComponents = ColorUtils.parseHexColor(this.color);
            }

            return this.#colorComponents;
        }
    }
}

/** @abstract */
export class IColoredObject extends IColoredMixin(IRenderObject) {
}