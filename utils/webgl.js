export function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
        console.error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

export function createProgram(gl, vertexShader, fragmentShader, transformFeedbacks = null) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    if (transformFeedbacks && transformFeedbacks.length > 0) {
        gl.transformFeedbackVaryings(program, transformFeedbacks, gl.SEPARATE_ATTRIBS);
    }

    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        console.error(gl.getProgramInfoLog(program));
    }

    return program;
}

export function createVertexArray(gl, entries) {
    const vertexArray = gl.createVertexArray();
    for (let i = 0; i < entries.length; i++) {
        const {attribute, buffer, type, size, stride, offset, divisor} = entries[i];
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bindVertexArray(vertexArray);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, size, type, false, stride, offset);
        if (divisor) gl.vertexAttribDivisor(attribute, divisor);
    }

    return vertexArray;
}

export function createTransformFeedback(gl, ...buffers) {
    const tf = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    for (let i = 0; i < buffers.length; i++) {
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, buffers[i]);
    }

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    return tf;
}

export function loadTexture(gl, state, textureName, data, params) {
    if (state.textures[textureName] === null) state.textures[textureName] = gl.createTexture();

    const texture = state.textures[textureName];
    const {width, height, format, internalFormat, type, mip, border, params: {min, mag, wrapS, wrapT}} = params;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, mip || 0, internalFormat, width, height, border || 0, format, type, data);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);

    return texture;
}

export function loadImageTexture(gl, texture, source, params) {
    const {format, internalFormat, type, mip, params: {min, mag, wrapS, wrapT}} = params;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, mip || 0, internalFormat, format, type, source);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
}

function _getBuffer(stateConfig, currentProgramName, path) {
    const parts = path.split(".");

    let bufferName;
    if (parts.length === 2) {
        currentProgramName = parts[0];
        bufferName = parts[1];
    } else {
        bufferName = path;
    }

    return stateConfig[currentProgramName].buffers[bufferName];
}

function createFrameBuffer(gl, programConfig, fbConfig) {
    const fb = gl.createFramebuffer();

    const textureParams = programConfig._config.textures[fbConfig.texture];
    const texture = loadTexture(gl, programConfig, fbConfig.texture, null, textureParams);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, fbConfig.attachment, gl.TEXTURE_2D, texture, 0);

    if (fbConfig.stencil) {
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, textureParams.width, textureParams.height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, rb);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return fb;
}

export function createFromConfig(gl, config, outStateConfig) {
    for (const configElement of config) {
        const programConfig = outStateConfig[configElement.program] || {
            program: null,
            internal: false,
            _config: {
                attributes: {},
                buffers: {},
                uniforms: {},
                vertexArrays: {},
                transformFeedbacks: {},
                textures: {}
            }
        };

        if (!programConfig.program) {
            outStateConfig[configElement.program] = programConfig;
            if (!configElement.internal) {
                programConfig.vs = createShader(gl, gl.VERTEX_SHADER, configElement.vs);
                programConfig.fs = createShader(gl, gl.FRAGMENT_SHADER, configElement.fs);
                programConfig.program = createProgram(gl, programConfig.vs, programConfig.fs, configElement.tfAttributes);

                gl.useProgram(programConfig.program);
            } else {
                programConfig.internal = true;
            }
        }

        const attributesConfig = programConfig.attributes || {};
        programConfig.attributes = attributesConfig;

        for (const attribute of configElement.attributes || []) {
            attributesConfig[attribute.name] = gl.getAttribLocation(
                programConfig.program, attribute.name);

            programConfig._config.attributes[attribute.name] = Object.assign({}, attribute);
        }

        const buffersConfig = programConfig.buffers || {};
        programConfig.buffers = buffersConfig;
        for (const buffer of configElement.buffers || []) {
            buffersConfig[buffer.name] = gl.createBuffer();
            programConfig._config.buffers[buffer.name] = Object.assign({}, buffer);
        }


        const uniformsConfig = programConfig.uniforms || {};
        programConfig.uniforms = uniformsConfig;
        for (const uniform of configElement.uniforms || []) {
            uniformsConfig[uniform.name] = gl.getUniformLocation(
                programConfig.program, uniform.name);
            programConfig._config.uniforms[uniform.name] = Object.assign({}, uniform);
        }

        const vertexArrayConfig = programConfig.vertexArrays || {};
        programConfig.vertexArrays = vertexArrayConfig;
        for (const va of configElement.vertexArrays || []) {
            const entries = va.entries.map(entry => ({
                attribute: attributesConfig[entry.name],
                divisor: entry.divisor,
                buffer: _getBuffer(outStateConfig, configElement.program, entry.buffer || entry.name),
                type: entry.type,
                size: entry.size,
                stride: entry.stride || 0,
                offset: entry.offset || 0
            }));

            vertexArrayConfig[va.name] = createVertexArray(gl, entries);
            programConfig._config.vertexArrays[va.name] = Object.assign({}, va);
        }

        const transformFeedbacks = programConfig.transformFeedbacks || {};
        programConfig.transformFeedbacks = transformFeedbacks;
        for (const tf of configElement.transformFeedbacks || []) {
            const buffers = tf.buffers.map(b => _getBuffer(outStateConfig, configElement.program, b));

            transformFeedbacks[tf.name] = createTransformFeedback(gl, ...buffers);
            programConfig._config.transformFeedbacks[tf.name] = Object.assign({}, tf);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

        const textures = programConfig.textures || {};
        programConfig.textures = textures;
        for (const tex of configElement.textures || []) {
            textures[tex.name] = null;
            programConfig._config.textures[tex.name] = Object.assign({}, tex);
        }

        const fbs = programConfig.frameBuffers || {};
        programConfig.frameBuffers = fbs;
        for (const fbConfig of configElement.frameBuffers || []) {
            fbs[fbConfig.name] = createFrameBuffer(gl, programConfig, fbConfig);
            ;
        }
    }
}

export function loadDataFromConfig(gl, stateConfig, dataConfig) {
    for (const dc of dataConfig) {
        const state = stateConfig[dc.program];
        const program = dc.linkProgram ? stateConfig[dc.linkProgram].program : state.program

        if (program) {
            gl.useProgram(program);
        }

        if (dc.uniforms) {
            for (const uniformConfig of dc.uniforms) {
                const type = state._config.uniforms[uniformConfig.name].type;

                gl[type](state.uniforms[uniformConfig.name], ...uniformConfig.values);
            }
        }

        if (dc.buffers) {
            for (const bufferConfig of dc.buffers) {
                const usageHint = state._config.buffers[bufferConfig.name].usageHint;
                const type = state._config.buffers[bufferConfig.name].type ?? gl.ARRAY_BUFFER;

                gl.bindBuffer(type, state.buffers[bufferConfig.name]);
                gl.bufferData(type, bufferConfig.data, usageHint);
            }
        }
    }
}

export function loadTextures(gl, stateConfig, programKey, textures) {
    const state = stateConfig[programKey];
    const textConfigs = Object.values(state._config.textures || {});
    if (textures.length !== textConfigs.length) throw new Error("Texture count mismatch");

    gl.useProgram(state.program);

    let index = 0;
    for (const texConfig of textures) {
        const initTextConfig = state._config.textures[texConfig.name];
        const params = texConfig.params ?? initTextConfig;

        gl.activeTexture(gl.TEXTURE0 + index);

        if (texConfig.source) {
            if (texConfig.source.glTexture === null) texConfig.source.glTexture = gl.createTexture();
            loadImageTexture(gl, texConfig.source.glTexture, texConfig.source.source, params);
        } else {
            loadTexture(gl, state, texConfig.name, texConfig.data, params);
        }

        if (params.generateMipmap) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }

        if (!initTextConfig.location) {
            initTextConfig.location = gl.getUniformLocation(state.program, texConfig.name);
        }

        gl.uniform1i(initTextConfig.location, index);

        ++index;
    }
}

export function assignTextures(gl, stateConfig, programKey, ...glTextures) {
    const state = stateConfig[programKey];
    const textConfigs = Object.values(state._config.textures || {});
    if (glTextures.length !== textConfigs.length) throw new Error("Texture count mismatch");

    gl.useProgram(state.program);

    for (let index = 0; index < textConfigs.length; index++) {
        const tConf = textConfigs[index];
        const tex = glTextures[index];

        if (tex === null) throw new Error(`Texture ${tConf.name} not loaded`);

        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(tConf.location, index);
    }
}