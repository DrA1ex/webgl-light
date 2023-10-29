import {RectObject} from "../objects/rect.js";
import {m4} from "../utils/m4.js";
import * as WebglUtils from "../utils/webgl.js";
import * as Data from "./data.js";
import * as ShaderConfig from "./shaders/config.js";

const GL = WebGL2RenderingContext;

export class Renderer {
    #canvas;
    #rect;

    #config;
    #gl;
    #glConfig = {};
    #glSupportFloatTexture;

    #resolutionScale;

    get width() {return this.#canvas.width;}
    get height() {return this.#canvas.height;}

    setProjectionMatrix(matrix) {
        WebglUtils.loadDataFromConfig(this.#gl, this.#glConfig, this.#config.map(s => ({
            program: s.program,
            uniforms: [
                {name: "projection", values: [false, matrix]},
            ]
        })));
    }

    constructor(canvas, resolutionScale = devicePixelRatio) {
        this.#resolutionScale = resolutionScale;
        this.#canvas = canvas;
        this.#rect = canvas.getBoundingClientRect();
        this.#gl = canvas.getContext("webgl2", {premultipliedAlpha: true, stencil: true});
    }

    async init() {
        this.#canvas.width = this.#rect.width * this.#resolutionScale;
        this.#canvas.height = this.#rect.height * this.#resolutionScale;

        const projection = m4.projection(this.#rect.width, this.#rect.height, 2);

        this.#gl.viewport(0, 0, this.width, this.height);
        this.#gl.clearColor(0, 0, 0, 1);
        this.#gl.clear(GL.COLOR_BUFFER_BIT);

        this.#gl.enable(GL.BLEND);
        this.#gl.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);

        this.#gl.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        this.#gl.enable(GL.DEPTH_TEST);
        this.#gl.depthFunc(GL.LEQUAL);

        this.#config = await ShaderConfig.createShaderConfig(this.width, this.height);
        WebglUtils.createFromConfig(this.#gl, this.#config, this.#glConfig);

        WebglUtils.loadDataFromConfig(this.#gl, this.#glConfig, this.#config.map(s => ({
            program: s.program,
            uniforms: [
                {name: "projection", values: [false, projection]},
            ]
        })));
    }

    render(delta, objects, lights) {
        this.#gl.clearColor(0, 0, 0, 1);
        this.#gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        this.#gl.bindFramebuffer(GL.FRAMEBUFFER, this.#glConfig["special_fx"].frameBuffers["fb_0"]);
        this.#gl.clearColor(0, 0, 0, 1);
        this.#gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT);

        this.#renderLights(objects, lights);
        this.#renderBodies(objects);

        this.#gl.bindFramebuffer(GL.FRAMEBUFFER, null);
        this.#gl.useProgram(this.#glConfig["special_fx"].program);
        this.#gl.bindTexture(GL.TEXTURE_2D, this.#glConfig["special_fx"].textures["texture_0"]);

        this.#renderFx();
        this.#gl.bindTexture(GL.TEXTURE_2D, null);
    }

    #renderBodies(objects) {
        const objData = Data.prepareObjectsData(objects.filter(o => o.opacity > 0));

        WebglUtils.loadDataFromConfig(this.#gl, this.#glConfig, [{
            program: "main",
            buffers: [
                {name: "point", data: objData.points},
                {name: "position", data: objData.positions},
                {name: "size", data: objData.sizes},
                {name: "color", data: objData.colors},

                {name: "indexed", data: objData.indexes},
            ]
        }]);

        this.#gl.useProgram(this.#glConfig["main"].program);
        this.#gl.bindVertexArray(this.#glConfig["main"].vertexArrays["body"]);
        this.#gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.#glConfig["main"].buffers["indexed"]);
        this.#gl.drawElements(GL.TRIANGLES, objData.indexes.length, GL.UNSIGNED_SHORT, 0);
    }

    #renderLights(objects, lights) {
        this.#gl.enable(GL.STENCIL_TEST);
        this.#gl.blendFunc(GL.ONE, GL.ONE);

        const lightData = Data.prepareLightData(
            objects.filter(obj => obj.castShadows && obj.opacity !== 0));

        for (const light of lights) {
            this.#renderSingleLight(light, lightData);
        }

        this.#gl.disable(GL.STENCIL_TEST);
        this.#gl.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
    }

    #renderFx() {
        const dummyObj = new RectObject(
            this.#rect.width / 2, this.#rect.height / 2,
            this.#rect.width, this.#rect.height
        );
        dummyObj.color = "#000000";
        dummyObj.opacity = 0;

        const maskData = Data.prepareObjectsData([dummyObj]);
        WebglUtils.loadDataFromConfig(this.#gl, this.#glConfig, [{
            program: "special_fx",
            uniforms: [{
                name: "projection",
                values: [false, m4.projection(this.#rect.width, this.#rect.height, 2)]
            }, {
                name: "effect",
                values: [1]
            }, {
                name: "resolution",
                values: [this.width, this.height]
            }],
            buffers: [
                {name: "point", data: new Float32Array(maskData.points)},
                {name: "position", data: new Float32Array(maskData.positions)},
                {name: "size", data: new Float32Array(maskData.sizes)},
                {name: "color", data: new Float32Array(maskData.colors)},

                {name: "indexed", data: new Uint16Array(maskData.indexes)},
            ]
        }]);

        this.#gl.useProgram(this.#glConfig["special_fx"].program);
        this.#gl.bindVertexArray(this.#glConfig["special_fx"].vertexArrays["body"]);
        this.#gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.#glConfig["special_fx"].buffers["indexed"]);
        this.#gl.drawElements(GL.TRIANGLES, maskData.indexes.length, GL.UNSIGNED_SHORT, 0);
    }

    #renderSingleLight(light, lightData) {
        this.#gl.clear(GL.STENCIL_BUFFER_BIT);

        this.#gl.colorMask(false, false, false, false);
        this.#gl.stencilOp(GL.KEEP, GL.KEEP, GL.REPLACE);
        this.#gl.stencilFunc(GL.ALWAYS, 1, 0xff);
        this.#renderLightMask(light, lightData);

        this.#gl.colorMask(true, true, true, true);
        this.#gl.stencilOp(GL.KEEP, GL.KEEP, GL.KEEP);
        this.#gl.stencilFunc(GL.EQUAL, 0, 0xff);
        this.#renderLightBackground(light);
    }

    #renderLightMask(light, lightData) {
        this.#gl.useProgram(this.#glConfig["light"].program);
        this.#gl.bindVertexArray(this.#glConfig["light"].vertexArrays["body"]);

        WebglUtils.loadDataFromConfig(this.#gl, this.#glConfig, [{
            program: "light",
            uniforms: [
                {name: "light_pos", values: [light.x, light.y]},
                {name: "light_radius", values: [light.radius]}
            ],
            buffers: [
                {name: "point", data: lightData.points},
                {name: "indexed", data: lightData.indexes},
            ]
        }]);

        this.#gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.#glConfig["light"].buffers["indexed"]);
        this.#gl.drawElements(GL.TRIANGLES, lightData.indexes.length, GL.UNSIGNED_SHORT, 0);
    }

    #renderLightBackground(light) {
        const mask = light.mask;
        mask.opacity = 0;
        const maskData = Data.prepareObjectsData([mask]);
        maskData.colors[3] = light.intensity;

        this.#gl.useProgram(this.#glConfig["main"].program);
        this.#gl.bindVertexArray(this.#glConfig["main"].vertexArrays["body"]);

        WebglUtils.loadDataFromConfig(this.#gl, this.#glConfig, [{
            program: "main",
            buffers: [
                {name: "point", data: new Float32Array(maskData.points)},
                {name: "position", data: new Float32Array(maskData.positions)},
                {name: "size", data: new Float32Array(maskData.sizes)},
                {name: "color", data: new Float32Array(maskData.colors)},

                {name: "indexed", data: new Uint16Array(maskData.indexes)},
            ]
        }]);

        this.#gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.#glConfig["main"].buffers["indexed"]);
        this.#gl.drawElements(GL.TRIANGLES, maskData.indexes.length, GL.UNSIGNED_SHORT, 0);
    }
}