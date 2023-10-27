import {BoundaryBox} from "./boundary.js";

const EPSILON = 1e-9;

class SpatialLeaf {
    /** @type{SpatialLeaf[]} */
    leafs = [];
    /** @type{BoundaryBox} */
    boundary;
    /** @type{BoundaryBox} */
    segmentBoundary;
    /** @type{IRenderObject[]} */
    items;
    containsActive = true;

    id = 0;

    /**
     * @param {number} id
     * @param {IRenderObject[]} items
     * @param {BoundaryBox} boundary
     * @param {BoundaryBox} segmentBoundary
     * @param {Boolean} containsActive
     */
    constructor(id, items, boundary, segmentBoundary, containsActive) {
        this.id = id;
        this.items = items;
        this.boundary = boundary;
        this.segmentBoundary = segmentBoundary;
        this.containsActive = containsActive;
    }

    addLeaf(leaf) {
        this.leafs.push(leaf);
    }
}

export class SpatialTree {
    #leafId = 0;

    /** @type {SpatialLeaf} */
    root = null;
    divider = 0;
    maxCount = 0;

    /**
     * @param {IRenderObject[]} items
     * @param {number} divider
     * @param {number} maxCount
     */
    constructor(items, divider, maxCount) {
        this.divider = divider;
        this.maxCount = maxCount;

        const boundary = BoundaryBox.fromBodies(items);
        const segmentBoundary = this.#createLevelBoundary(boundary);

        this.root = new SpatialLeaf(this.#leafId++, items, boundary, segmentBoundary, true);

        this.#fillLeaf(this.root);
    }

    getSegmentBodies(boundary) {
        function _walk(node, parent = null) {
            if (BoundaryBox.isInside(boundary, node.segmentBoundary)) {
                return (parent ?? node).items;
            }

            for (const leaf of node.leafs) {
                if (_walk(leaf, node)) {
                    return node.items;
                }
            }

            return false;
        }

        let items;
        if (this.root.leafs.length === 0 || !BoundaryBox.isInside(this.root.segmentBoundary, boundary)) {
            items = this.root.items;
        } else {
            items = _walk(this.root) || [];
        }

        return items.filter(item => SpatialTree.#isContainedByBoundary(item, boundary));
    }

    #fillLeaf(leaf) {
        if (leaf.items.length <= this.maxCount) return;

        for (const segment of this.#iterateSegments(leaf.segmentBoundary)) {
            const child = this.#createLeaf(leaf, segment);
            if (child) leaf.addLeaf(child);
        }

        for (const child of leaf.leafs) {
            this.#fillLeaf(child);
        }
    }

    #createLeaf(parent, segmentBoundary) {
        const {items} = parent;
        const filteredItems = items.filter(b => SpatialTree.#isContainedByBoundary(b, segmentBoundary));
        if (filteredItems.length <= 0) return null;

        const boundaryBox = BoundaryBox.fromBodies(filteredItems);
        const containsActive = parent.containsActive && filteredItems.some(b => b.active);

        return new SpatialLeaf(this.#leafId++, filteredItems, boundaryBox, segmentBoundary, containsActive);
    }

    * #iterateSegments(segmentBoundary) {
        const step = segmentBoundary.width / this.divider;
        if (step <= EPSILON) return;

        for (let i = 0; i < this.divider; i++) {
            const left = segmentBoundary.left + i * step
            const right = (i < this.divider - 1 ? left + step : segmentBoundary.right + EPSILON);

            for (let j = 0; j < this.divider; j++) {
                const top = segmentBoundary.top + j * step;
                const bottom = (j < this.divider - 1 ? top + step : segmentBoundary.bottom + EPSILON);

                yield new BoundaryBox(left, right, top, bottom);
            }
        }
    }

    #createLevelBoundary(boundary) {
        const maxDim = Math.max(...[
            boundary.left, boundary.right, boundary.top, boundary.bottom
        ].map(v => Math.abs(v)));

        const level = Math.ceil(Math.log(maxDim) / Math.log(this.divider));
        const dim = Math.pow(this.divider, level);
        return new BoundaryBox(-dim, dim, -dim, dim);
    }

    static #isContainedByBoundary(body, boundary) {
        return boundary.includes(body.position);
    }
}