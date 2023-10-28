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

    for (int i = 1; i < glow_kerner_size; ++i)
    {
        result += get_bright_color(u_texture, text_coord + vec2(tex_offset.x * float(i), 0.0)) * glow_weights[i];
        result += get_bright_color(u_texture, text_coord - vec2(tex_offset.x * float(i), 0.0)) * glow_weights[i];
    }

    for (int i = 1; i < glow_kerner_size; ++i)
    {
        result += get_bright_color(u_texture, text_coord + vec2(0.0, tex_offset.y * float(i))) * glow_weights[i];
        result += get_bright_color(u_texture, text_coord - vec2(0.0, tex_offset.y * float(i))) * glow_weights[i];
    }

    return result / 2.0;
}


vec3 get_bright_color(sampler2D tex, vec2 coord) {
    return bright_color(texture(tex, text_coord).rgb);
}

vec3 bright_color(vec3 color) {
    float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return vec3(color * brightness);
}