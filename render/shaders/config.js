import * as Shader from "./shader.js";

const GL = WebGL2RenderingContext;

export async function createShaderConfig(width, height) {
    const mainConfig = {
        program: "main",
        vs: Shader.BodyVert.trim(),
        fs: Shader.BodyFrag.trim(),
        attributes: [
            {name: "point"},
            {name: "position"},
            {name: "size"},
            {name: "color"},
        ],
        uniforms: [
            {name: "projection", type: "uniformMatrix4fv"},
        ],
        buffers: [
            {name: "point", usageHint: GL.STATIC_DRAW},
            {name: "position", usageHint: GL.STATIC_DRAW},
            {name: "size", usageHint: GL.STATIC_DRAW},
            {name: "color", usageHint: GL.STATIC_DRAW},

            {name: "indexed", usageHint: GL.STATIC_DRAW, type: GL.ELEMENT_ARRAY_BUFFER},
        ],
        vertexArrays: [{
            name: "body", entries: [
                {name: "point", type: GL.FLOAT, size: 2},
                {name: "position", type: GL.FLOAT, size: 2},
                {name: "size", type: GL.FLOAT, size: 2},
                {name: "color", type: GL.FLOAT, size: 4},
            ]
        }],
    };

    const lightMaskConfig = {
        program: "light",
        vs: Shader.LightVert.trim(),
        fs: Shader.LightFrag.trim(),
        attributes: [
            {name: "point"},
        ],
        uniforms: [
            {name: "projection", type: "uniformMatrix4fv"},
            {name: "light_pos", type: "uniform2f"},
            {name: "light_radius", type: "uniform1f"},
        ],
        buffers: [
            {name: "point", usageHint: GL.DYNAMIC_DRAW},

            {name: "indexed", usageHint: GL.STATIC_DRAW, type: GL.ELEMENT_ARRAY_BUFFER},
        ],
        vertexArrays: [{
            name: "body", entries: [
                {name: "point", type: GL.FLOAT, size: 3},
            ]
        }],
    };


    const fxConfig = {
        program: "special_fx",
        vs: Shader.SpecialFxVert.trim(),
        fs: Shader.SpecialFxFrag.trim(),
        attributes: mainConfig.attributes,
        buffers: mainConfig.buffers,
        uniforms: [
            ...mainConfig.uniforms,
            {name: "effect", type: "uniform1ui"},
            {name: "resolution", type: "uniform2f"},
        ],
        vertexArrays: mainConfig.vertexArrays,
        textures: [{
            name: "texture_0",
            width: width,
            height: height,
            format: GL.RGBA,
            internalFormat: GL.RGBA,
            type: GL.UNSIGNED_BYTE,
            params: {
                min: GL.NEAREST,
                mag: GL.NEAREST,
                wrapS: GL.CLAMP_TO_EDGE,
                wrapT: GL.CLAMP_TO_EDGE,
            },
            generateMipmap: false
        }, {
            name: "texture_1",
            width: width,
            height: height,
            format: GL.RGBA,
            internalFormat: GL.RGBA,
            type: GL.UNSIGNED_BYTE,
            params: {
                min: GL.NEAREST,
                mag: GL.NEAREST,
                wrapS: GL.CLAMP_TO_EDGE,
                wrapT: GL.CLAMP_TO_EDGE,
            },
            generateMipmap: false
        }],
        frameBuffers: [
            {name: "fb_0", texture: "texture_0", attachment: GL.COLOR_ATTACHMENT0, stencil: true},
            {name: "fb_1", texture: "texture_1", attachment: GL.COLOR_ATTACHMENT0, stencil: true},
        ]
    };

    return [
        mainConfig,
        lightMaskConfig,
        fxConfig
    ];
}