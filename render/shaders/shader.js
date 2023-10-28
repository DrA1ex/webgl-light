// language=Glsl
export const BodyVert = `
    #version 300 es

uniform mat4 projection;

in vec2 point;

in vec2 size;
in vec2 position;
in vec4 color;

out vec4 o_color;

void main() {
    gl_Position = projection * vec4(position + point * size, 0, 1);
    o_color = color;
}
`;

// language=Glsl
export const BodyFrag = `
#version 300 es
precision highp float;

in vec4 o_color;
out vec4 out_color;

void main() {
    out_color = vec4(o_color.rgb * o_color.a, o_color.a);
}
`;

// language=Glsl
export const LightVert = `
#version 300 es

uniform mat4 projection;
uniform vec2 light_pos;
uniform float light_radius;

in vec3 point;

void main() {
    vec2 out_point;
    if (point.z == 1.0) {
        out_point = normalize(point.xy - light_pos) * (light_radius * 1.2) + light_pos;
    } else {
        out_point = point.xy;
    }

    gl_Position = projection * vec4(out_point, 0., 1);
}
`;

// language=Glsl
export const LightFrag = `
#version 300 es
precision highp float;

out vec4 out_color;

void main() {
    out_color = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

// language=Glsl
export const SpecialFxVert = `
#version 300 es

uniform mat4 projection;
uniform uint effect;
uniform vec2 resolution;

in vec2 point;

in vec2 size;
in vec2 position;
in vec4 color;

out vec4 o_color;
out vec2 text_coord;
out vec2 o_resolution;
flat out uint o_effect;

void main() {
    gl_Position = projection * vec4(position + point * size, 0, 1);
    o_color = color;

    text_coord = (gl_Position.xy + 1.0) / 2.0;
    o_effect = effect;
    o_resolution = resolution;
}
`;

// language=Glsl
export const SpecialFxFrag = `
#version 300 es
precision highp float;

float glow_weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
int glow_kerner_size = 5;

uniform sampler2D u_texture;

in vec2 text_coord;
in vec4 o_color;
in vec2 o_resolution;
flat in uint o_effect;

out vec4 res;

vec3 glow();

vec3 get_bright_color(sampler2D tex, vec2 coord);
vec3 bright_color(vec3 color);

void main() {
    vec4 src = vec4(o_color.rgb * o_color.a, o_color.a);
    vec4 dst = texture(u_texture, text_coord);

    if (o_effect == 0u) {
        res = src + dst;
    } else if (o_effect == 1u) {
        vec3 glow_color = glow();
        res = vec4(dst.rgb + glow_color, dst.a);
    }
}

vec3 glow() {
    vec2 tex_offset = 1.0 / o_resolution;
    vec3 result = get_bright_color(u_texture, text_coord) * glow_weights[0];

    for (int i = 1; i < glow_kerner_size; ++i) {
        result += get_bright_color(u_texture, text_coord + vec2(tex_offset.x * float(i), 0.0)) * glow_weights[i];
        result += get_bright_color(u_texture, text_coord - vec2(tex_offset.x * float(i), 0.0)) * glow_weights[i];
    }

    for (int i = 1; i < glow_kerner_size; ++i) {
        result += get_bright_color(u_texture, text_coord + vec2(0.0, tex_offset.y * float(i))) * glow_weights[i];
        result += get_bright_color(u_texture, text_coord - vec2(0.0, tex_offset.y * float(i))) * glow_weights[i];
    }

    return result / 2.0;
}


vec3 get_bright_color(sampler2D tex, vec2 coord) {
    return bright_color(texture(tex, coord).rgb);
}

vec3 bright_color(vec3 color) {
    float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return vec3(color * brightness);
}
`;